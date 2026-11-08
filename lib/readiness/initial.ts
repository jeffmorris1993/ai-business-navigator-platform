// Initial readiness report from onboarding answers alone (before any records are inspected).
// Separates what the owner told us from what's verified. Never claims readiness without data.
import type { Business, ProfileAnswers } from "../types";
import type { CapabilityKey } from "./rules";

export interface InitialReport {
  has: string[];
  notVerified: string[];
  missing: string[];
  mightHelp: Array<{ capability: CapabilityKey; label: string; why: string }>;
  next: string;
}

export function initialReport(b: Business, a: ProfileAnswers, counts: { opps: number; invoices: number; expenses: number; weeks: number }): InitialReport {
  const has: string[] = [];
  const notVerified: string[] = [];
  const missing: string[] = [];
  const mightHelp: InitialReport["mightHelp"] = [];
  const text = `${b.biggest_challenge ?? ""} ${b.main_goal ?? ""}`.toLowerCase();
  const spreadsheet = /excel|sheet|spreadsheet|csv/i.test(b.sales_tracking ?? "");
  const manual = b.data_path === "manual";
  const accounting = /quickbooks|freshbooks|xero|wave|accounting/i.test(b.invoicing ?? "");

  if (b.sales_tracking) has.push(`You track sales in ${b.sales_tracking} (you told us)`);
  if (b.invoicing) has.push(`You handle invoices in ${b.invoicing} (you told us)`);
  if (a.records_maintainer) has.push(`${a.records_maintainer} keeps the records`);
  if (a.human_approval === "yes") has.push("A person will approve messages before they go out");

  if (counts.opps === 0 && (spreadsheet || !manual)) {
    notVerified.push("Whether your sales records include customer names, estimate values and statuses");
    notVerified.push("Whether your records show when each customer was last contacted");
  }
  if (counts.invoices === 0 && accounting) notVerified.push(`Whether your ${b.invoicing} export includes due dates and unpaid balances`);
  if (!a.customer_permission) notVerified.push("Permission to use customer contact information");
  if (manual && counts.weeks === 0) missing.push("Weekly appointment or sales numbers (a 1-minute form)");
  if (counts.opps === 0 && !manual && !/no tracking|word of mouth|pos|point-of-sale|shop management|not tracked/i.test(b.sales_tracking ?? "")) missing.push("Your sales or estimates spreadsheet");
  if (counts.invoices === 0) missing.push(accounting ? `An invoice export from ${b.invoicing}` : "An invoice list (if you send invoices)");

  if (/follow|lead|sales|estimate|proposal|close|customer/.test(text) && !manual) {
    mightHelp.push({ capability: "missed_followup", label: "Missed follow-up detection", why: "You said following up is a challenge. This finds open estimates nobody has contacted recently." });
    mightHelp.push({ capability: "sales_pipeline", label: "Sales pipeline analysis", why: "See what open estimates are worth and which matter most." });
    mightHelp.push({ capability: "communication_drafting", label: "Customer message drafting", why: "Draft follow-ups for you to review, so you save time without hiring help." });
  }
  if (/paid|cash|invoice|money|late|collect/.test(text) || accounting) {
    mightHelp.push({ capability: "overdue_invoices", label: "Overdue invoice analysis", why: "Find who owes you money and how late it is." });
  }
  if (/cost|expense|margin|profit|spend/.test(text)) mightHelp.push({ capability: "expense_trends", label: "Expense trend analysis", why: "Spot categories where costs are rising." });
  if (manual || /appointment|chair|slot|book/.test(text)) mightHelp.push({ capability: "appointment_capacity", label: "Unused appointment capacity", why: "Estimate the value of empty and cancelled slots from simple weekly numbers." });
  if (!mightHelp.length) mightHelp.push({ capability: "sales_pipeline", label: "Sales pipeline analysis", why: "A good first step for most businesses with sales records." });

  const noSalesSheet = /no tracking|word of mouth|pos|point-of-sale|shop management|not tracked/i.test(b.sales_tracking ?? "");
  const next = manual
    ? "Enter last week's numbers so I can look at real information."
    : counts.opps === 0 && !noSalesSheet
      ? `Upload your ${spreadsheet ? "estimates spreadsheet" : "sales records"} so I can check what's actually in them.`
      : counts.invoices + counts.expenses === 0
        ? "Upload your invoices or expenses so I can check what's actually in them."
        : "Review your readiness by capability below.";
  return { has, notVerified, missing, mightHelp, next };
}
