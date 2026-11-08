import { describe, it, expect } from "vitest";
import { assessAll, type ReadinessInput, type CapabilityKey } from "@/lib/readiness/rules";
import * as S from "@/lib/samples/data";
import { importRows } from "./helpers";
import type { Business, SalesOpportunity, Invoice, Expense, ManualWeek } from "@/lib/types";

const TODAY = "2026-11-08";
const metro: Business = {
  id: "biz", slug: "metro-roofing", sponsor_id: null, name: "Metro Roofing", industry: "Roofing and construction",
  sales_tracking: "Excel spreadsheets", invoicing: "QuickBooks", biggest_challenge: "Following up with customers",
  ai_experience: "Beginner", main_goal: "Increase sales without hiring another administrator", data_path: "spreadsheet", onboarded: true, is_sample: true,
};

function input(over: Partial<ReadinessInput>): ReadinessInput {
  return { business: metro, answers: {}, opps: [], invoices: [], expenses: [], appointments: [], weeks: [], cash: null, lastUpdated: {}, asOf: TODAY, ...over };
}
const statusOf = (i: ReadinessInput) => Object.fromEntries(assessAll(i).map((r) => [r.capability, r])) as Record<CapabilityKey, ReturnType<typeof assessAll>[number]>;

describe("Acceptance test 1: readiness before and after", () => {
  it("before upload: nothing is claimed ready", () => {
    const r = statusOf(input({}));
    expect(r.sales_pipeline.status).toBe("not_assessed");
    expect(r.missed_followup.status).toBe("not_assessed");
    expect(r.overdue_invoices.status).toBe("not_assessed");
    expect(Object.values(r).some((x) => x.status === "ready")).toBe(false);
  });

  it("after estimates upload without contact dates: pipeline ready, follow-up needs setup", () => {
    const { records } = importRows<SalesOpportunity>(S.metroEstimates(false));
    const r = statusOf(input({ opps: records, lastUpdated: { sales: TODAY } }));
    expect(r.sales_pipeline.status).toBe("ready");
    expect(r.missed_followup.status).toBe("needs_setup");
    expect(r.missed_followup.fixAction).toBe("add_last_contact_dates");
    expect(r.missed_followup.missing[0]).toMatch(/Last contact date missing on 18 open estimates/);
    expect(r.overdue_invoices.status).toBe("not_assessed");
  });

  it("after contact dates added: follow-up becomes ready", () => {
    const { records } = importRows<SalesOpportunity>(S.metroEstimates(true));
    const r = statusOf(input({ opps: records, lastUpdated: { sales: TODAY } }));
    expect(r.missed_followup.status).toBe("ready");
    expect(r.missed_followup.evidence.join(" ")).toMatch(/2 confirmed as unknown/);
  });

  it("partial when only some dates are filled", () => {
    const { records } = importRows<SalesOpportunity>(S.metroEstimates(false));
    records.filter((o) => o.status === "open").slice(0, 5).forEach((o) => (o.last_contact_on = "2026-10-01"));
    expect(statusOf(input({ opps: records })).missed_followup.status).toBe("partial");
  });

  it("stale data downgrades readiness", () => {
    const { records } = importRows<SalesOpportunity>(S.metroEstimates(true));
    const r = statusOf(input({ opps: records, lastUpdated: { sales: "2026-08-01" } }));
    expect(r.missed_followup.status).toBe("partial");
    expect(r.sales_pipeline.status).toBe("partial");
  });
});

describe("financial readiness", () => {
  it("overdue analysis ready with due dates + balances", () => {
    const { records } = importRows<Invoice>(S.metroInvoices());
    expect(statusOf(input({ invoices: records, lastUpdated: { invoices: TODAY } })).overdue_invoices.status).toBe("ready");
  });
  it("needs setup when only invoice totals exist", () => {
    const { records } = importRows<Invoice>(S.metroInvoices());
    records.forEach((r) => (r.amount_due = null));
    const r = statusOf(input({ invoices: records })).overdue_invoices;
    expect(r.status).toBe("needs_setup");
    expect(r.missing.join(" ")).toMatch(/isn't the same as an unpaid balance/);
  });
  it("Acceptance test 6: cash flow lists what's missing", () => {
    const { records } = importRows<Invoice>(S.metroInvoices());
    const r = statusOf(input({ invoices: records })).cash_flow;
    expect(r.status).toBe("needs_setup");
    expect(r.missing.join(" ")).toMatch(/cash on hand/);
  });
  it("expense trends ready for the restaurant", () => {
    const { records } = importRows<Expense>(S.kitchenExpenses());
    expect(statusOf(input({ expenses: records })).expense_trends.status).toBe("ready");
  });
});

describe("Acceptance test 5: manual business", () => {
  const salon: Business = { ...metro, name: "The Beauty Lounge", industry: "Salon", data_path: "manual" };
  it("capacity ready from weekly numbers, customer follow-up not possible", () => {
    const weeks = S.beautyLoungeWeeks().map((w, i) => ({ id: String(i), ...w })) as ManualWeek[];
    const r = statusOf(input({ business: salon, weeks, lastUpdated: { manual: TODAY } }));
    expect(r.appointment_capacity.status).toBe("ready");
    expect(r.missed_followup.status).toBe("needs_setup");
    expect(r.missed_followup.missing[0]).toMatch(/Customer-level records/);
  });
  it("salon with no numbers yet needs setup for capacity", () => {
    expect(statusOf(input({ business: salon })).appointment_capacity.status).toBe("needs_setup");
  });
});

describe("communication drafting respects privacy answers", () => {
  it("partial until permission confirmed, ready after", () => {
    const { records } = importRows<SalesOpportunity>(S.metroEstimates(true));
    expect(statusOf(input({ opps: records })).communication_drafting.status).toBe("partial");
    expect(statusOf(input({ opps: records, answers: { customer_permission: "yes", human_approval: "yes" } })).communication_drafting.status).toBe("ready");
    expect(statusOf(input({ opps: records, answers: { customer_permission: "no" } })).communication_drafting.status).toBe("needs_setup");
  });
});
