import { describe, it, expect } from "vitest";
import { parseDate, daysBetween } from "@/lib/calc/dates";
import { parseMoney, sumMoney } from "@/lib/calc/money";
import { calculatePipeline, findStaleOpportunities, analyzeAppointmentCapacity } from "@/lib/calc/sales";
import { findOverdueInvoices, applyPayment, analyzeExpenses, calculateCashScenario } from "@/lib/calc/finance";
import * as S from "@/lib/samples/data";
import { importRows } from "./helpers";
import type { SalesOpportunity, Invoice, Expense, ManualWeek } from "@/lib/types";

const TODAY = "2026-11-08";

describe("parsing", () => {
  it("parses common date formats and refuses to guess", () => {
    expect(parseDate("6/4/2026")).toBe("2026-06-04");
    expect(parseDate("2026-10-02")).toBe("2026-10-02");
    expect(parseDate("Mar 5, 2026")).toBe("2026-03-05");
    expect(parseDate("5-Mar-26")).toBe("2026-03-05");
    expect(parseDate(46000)).toBe("2025-12-09");
    expect(parseDate("Unknown")).toBeNull();
    expect(parseDate("13/45/2026")).toBeNull();
    expect(parseDate("next week")).toBeNull();
  });
  it("parses money safely", () => {
    expect(parseMoney("$18,500")).toBe(18500);
    expect(parseMoney("(300.50)")).toBe(-300.5);
    expect(parseMoney("12k")).toBe(12000);
    expect(parseMoney("about 500")).toBeNull();
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
  });
  it("counts days", () => {
    expect(daysBetween("2026-10-31", TODAY)).toBe(8);
  });
});

describe("sales calculations (Metro Roofing)", () => {
  const { records } = importRows<SalesOpportunity>(S.metroEstimates(true));
  it("imports 40 estimates with 18 open", () => {
    expect(records).toHaveLength(S.METRO_EXPECTED.estimates);
    expect(calculatePipeline(records).open.count).toBe(S.METRO_EXPECTED.open);
  });
  it("finds 11 stale open estimates totaling $62,000", () => {
    const r = findStaleOpportunities(records, TODAY, 7);
    expect(r.stale).toHaveLength(S.METRO_EXPECTED.staleCount);
    expect(r.totalValue).toBe(S.METRO_EXPECTED.staleValue);
    expect(r.excludedUnknownContact).toHaveLength(S.METRO_EXPECTED.unknownContact);
    expect(r.stale.every((s) => s.days_since_contact > 7)).toBe(true);
  });
  it("cannot find stale estimates when contact dates are absent", () => {
    const { records: noContacts } = importRows<SalesOpportunity>(S.metroEstimates(false));
    const r = findStaleOpportunities(noContacts, TODAY);
    expect(r.stale).toHaveLength(0);
    expect(r.excludedMissingContact).toHaveLength(18);
  });
});

describe("financial calculations", () => {
  it("BrightPath: 6 overdue invoices totaling $9,200", () => {
    const { records } = importRows<Invoice>(S.brightpathInvoices());
    const r = findOverdueInvoices(records, TODAY);
    expect(r.count).toBe(S.BRIGHTPATH_EXPECTED.overdueCount);
    expect(r.total).toBe(S.BRIGHTPATH_EXPECTED.overdueTotal);
  });
  it("Metro: uses Open Balance, not Amount, for overdue totals", () => {
    const { records, mapping } = importRows<Invoice>(S.metroInvoices());
    expect(mapping.columns["Amount"]).toBe("total_amount");
    expect(mapping.columns["Open Balance"]).toBe("amount_due");
    const r = findOverdueInvoices(records, TODAY);
    expect(r.count).toBe(S.METRO_INVOICE_EXPECTED.overdueCount);
    expect(r.total).toBe(S.METRO_INVOICE_EXPECTED.overdueTotal);
  });
  it("recording a payment reduces the overdue total", () => {
    const { records } = importRows<Invoice>(S.brightpathInvoices());
    const target = records.find((i) => i.invoice_no === "BP-201")!;
    const { newBalance } = applyPayment(target.amount_due!, 1000);
    target.amount_due = newBalance;
    expect(findOverdueInvoices(records, TODAY).total).toBe(8200);
    target.amount_due = applyPayment(target.amount_due, 1400).newBalance;
    const after = findOverdueInvoices(records, TODAY);
    expect(after.count).toBe(5);
    expect(after.total).toBe(6800);
  });
  it("rejects invalid payments and reports overpayment", () => {
    expect(() => applyPayment(100, 0)).toThrow();
    expect(applyPayment(100, 150)).toEqual({ newBalance: 0, overpayment: 50 });
  });
  it("excludes invoices without balances instead of using totals", () => {
    const inv: Invoice[] = [{ id: "a", business_id: "b", source_file_id: null, source_row: 2, invoice_no: "1", customer: "X", issued_on: null, due_on: "2026-01-01", total_amount: 500, amount_due: null }];
    const r = findOverdueInvoices(inv, TODAY);
    expect(r.total).toBe(0);
    expect(r.missingBalance).toHaveLength(1);
  });
  it("Neighborhood Kitchen: food costs are rising", () => {
    const { records } = importRows<Expense>(S.kitchenExpenses());
    const r = analyzeExpenses(records, TODAY);
    expect(r.sufficient).toBe(true);
    if (!r.sufficient) return;
    expect(r.categories[0].category).toMatch(/Food/);
    expect(r.totalChangePct!).toBeGreaterThan(0);
    const meat = r.categories.find((c) => c.category === "Food - Meat")!;
    expect(meat.priorMonthlyAvg).toBe(6250);
    expect(meat.recentMonthlyAvg).toBe(7650);
  });
  it("cash scenario refuses without cash information", () => {
    const { records: inv } = importRows<Invoice>(S.metroInvoices());
    const r = calculateCashScenario({ cash: null, invoices: inv, expenses: [], asOf: TODAY });
    expect(r.available).toBe(false);
    if (r.available) return;
    expect(r.missing.join(" ")).toMatch(/cash on hand/);
    expect(r.missing.join(" ")).toMatch(/expenses/);
  });
  it("cash scenario works with complete information", () => {
    const { records: inv } = importRows<Invoice>(S.freshstartInvoices());
    const { records: ex } = importRows<Expense>(S.freshstartExpenses());
    const r = calculateCashScenario({ cash: { as_of: TODAY, cash_on_hand: 40000 }, invoices: inv, expenses: ex, asOf: TODAY });
    expect(r.available).toBe(true);
    if (!r.available) return;
    expect(r.scenarios[2].endingCash).toBe(40000 - r.expectedExpenses);
  });
});

describe("appointment capacity (manual)", () => {
  it("computes unused capacity from weekly totals only", () => {
    const weeks = S.beautyLoungeWeeks().map((w, i) => ({ id: String(i), ...w })) as ManualWeek[];
    const r = analyzeAppointmentCapacity(weeks);
    expect(r.weeks).toBe(5);
    expect(r.totalUnusedSlots).toBe(24 + 7 + 28 + 9 + 19 + 6 + 32 + 11 + 26 + 8);
    expect(r.estimatedUnusedValue).toBe(31 * 68 + 37 * 70 + 25 * 69 + 43 * 71 + 34 * 70);
  });
});
