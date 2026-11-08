import { describe, it, expect } from "vitest";
import { evaluateFinding, dedupeKey, overlaps, softwareCandidates, type FindingRef } from "@/lib/intelligence/evaluate";
import type { ReadinessInput } from "@/lib/readiness/rules";
import * as S from "@/lib/samples/data";
import { importRows } from "./helpers";
import type { Business, SalesOpportunity, Invoice, Expense } from "@/lib/types";

const TODAY = "2026-11-08";
const metro: Business = { id: "biz", slug: "metro-roofing", sponsor_id: null, name: "Metro Roofing", industry: "Roofing", sales_tracking: "Excel", invoicing: "QuickBooks", biggest_challenge: "Follow-up", ai_experience: "Beginner", main_goal: "More sales", data_path: "spreadsheet", onboarded: true, is_sample: true };

function data(): ReadinessInput {
  return {
    business: metro, answers: { customer_permission: "yes", human_approval: "yes" },
    opps: importRows<SalesOpportunity>(S.metroEstimates(true)).records,
    invoices: importRows<Invoice>(S.metroInvoices()).records,
    expenses: importRows<Expense>(S.metroExpenses()).records,
    appointments: [], weeks: [], cash: null, lastUpdated: { sales: TODAY, invoices: TODAY, expenses: TODAY }, asOf: TODAY,
  };
}

describe("finding evaluation (software verification)", () => {
  it("computes overdue value from balances and resolves when paid", () => {
    const d = data();
    const overdue = d.invoices.filter((i) => (i.amount_due ?? 0) > 0 && i.due_on! < TODAY);
    const refs: FindingRef[] = overdue.map((i) => ({ type: "invoice", id: i.id }));
    const e = evaluateFinding("overdue_invoices", refs, null, d);
    expect(e.valid && e.stillApplies).toBe(true);
    expect(e.value).toBe(31700);
    // Pay one invoice: value drops, refs shrink
    overdue.find((i) => i.invoice_no === "1050")!.amount_due = 0;
    const e2 = evaluateFinding("overdue_invoices", refs, null, d);
    expect(e2.value).toBe(21300);
    expect(e2.qualifying).toHaveLength(4);
    overdue.forEach((i) => (i.amount_due = 0));
    const e3 = evaluateFinding("overdue_invoices", refs, null, d);
    expect(e3.stillApplies).toBe(false);
    expect(e3.resolvedNote).toMatch(/paid/);
  });

  it("stale estimates stop qualifying once contacted recently", () => {
    const d = data();
    const dana = d.opps.find((o) => o.customer === "Dana Whitfield")!;
    const refs: FindingRef[] = [{ type: "sales_opportunity", id: dana.id }];
    expect(evaluateFinding("stale_opportunities", refs, null, d).value).toBe(9600);
    dana.last_contact_on = TODAY;
    expect(evaluateFinding("stale_opportunities", refs, null, d).stillApplies).toBe(false);
  });

  it("rejects references that don't belong to the business or the category", () => {
    const d = data();
    expect(evaluateFinding("overdue_invoices", [{ type: "invoice", id: "not-a-real-id" }], null, d).valid).toBe(false);
    expect(evaluateFinding("overdue_invoices", [{ type: "sales_opportunity", id: d.opps[0].id }], null, d).valid).toBe(false);
    expect(evaluateFinding("made_up", [], null, d).valid).toBe(false);
  });

  it("customer balance must reference one customer's invoices", () => {
    const d = data();
    const two = d.invoices.filter((i) => (i.amount_due ?? 0) > 0).slice(0, 2).map((i) => ({ type: "invoice" as const, id: i.id }));
    expect(evaluateFinding("customer_balance", two, null, d).valid).toBe(false);
  });

  it("expense increase is computed by software (roofing materials)", () => {
    const e = evaluateFinding("expense_increase", [{ type: "expense_category", id: "Roofing Materials" }], null, data());
    expect(e.stillApplies).toBe(true);
    expect(e.value).toBe(4600);
  });

  it("readiness gaps: cash flow applies, irrelevant capacity doesn't", () => {
    const d = data();
    expect(evaluateFinding("readiness_gap", [{ type: "capability", id: "cash_flow" }], null, d).stillApplies).toBe(true);
    expect(evaluateFinding("readiness_gap", [{ type: "capability", id: "appointment_capacity" }], null, d).stillApplies).toBe(false);
    d.cash = { as_of: TODAY, cash_on_hand: 25000 };
    expect(evaluateFinding("readiness_gap", [{ type: "capability", id: "cash_flow" }], null, d).stillApplies).toBe(false);
  });

  it("readiness gating: no stale-estimate candidates without contact dates", () => {
    const d = data();
    d.opps = importRows<SalesOpportunity>(S.metroEstimates(false)).records;
    const c = softwareCandidates(d);
    expect(c.some((x) => x.category === "stale_opportunities")).toBe(false);
    expect(c.some((x) => x.category === "readiness_gap" && x.subject === "missed_followup")).toBe(true);
  });
});

describe("de-duplication", () => {
  it("same subject or single record gives the same key", () => {
    expect(dedupeKey("customer_balance", "Walter Simms", [])).toBe(dedupeKey("customer_balance", " walter simms ", []));
    expect(dedupeKey("priority_opportunity", null, [{ type: "sales_opportunity", id: "a" }])).toBe("priority_opportunity:a");
  });
  it("regrouped record sets are treated as the same issue", () => {
    const a = ["1", "2", "3", "4"].map((id) => ({ type: "invoice" as const, id }));
    const b = ["2", "3", "4", "5"].map((id) => ({ type: "invoice" as const, id }));
    expect(overlaps(a, b)).toBe(true);
    expect(overlaps(a, [{ type: "invoice", id: "9" }])).toBe(false);
  });
});

describe("software-only candidates (Metro)", () => {
  it("detects the issues present in the records", () => {
    const cats = softwareCandidates(data()).map((c) => c.category);
    expect(cats).toEqual(expect.arrayContaining(["stale_opportunities", "overdue_invoices", "expense_increase", "readiness_gap"]));
  });
});
