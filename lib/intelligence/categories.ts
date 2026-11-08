// Finding categories: which agent owns them, how their value is computed, and how software verifies them.
// Values and verification are deterministic; the AI only decides what to record and explains it.

export type FindingAgent = "readiness" | "sales" | "finance" | "software";
export type ValueKind = "potential_pipeline" | "outstanding_balance" | "expense_change" | "capacity_value" | "none";
export type RefType = "sales_opportunity" | "invoice" | "expense_category" | "capability" | "customer";

export interface CategoryDef {
  key: string;
  label: string;
  agent: Exclude<FindingAgent, "software">;
  valueKind: ValueKind;
  refType: RefType | null; // what record_refs must point to
  verifiable: boolean; // software can re-check and resolve it automatically
  description: string;
}

export const CATEGORIES: CategoryDef[] = [
  { key: "stale_opportunities", label: "Estimates needing follow-up", agent: "sales", valueKind: "potential_pipeline", refType: "sales_opportunity", verifiable: true, description: "Open estimates with no recorded contact in more than 7 days. Refs: the estimates." },
  { key: "stalled_proposals", label: "Stalled proposals", agent: "sales", valueKind: "potential_pipeline", refType: "sales_opportunity", verifiable: true, description: "Open estimates quoted more than 30 days ago with no decision. Refs: the estimates." },
  { key: "priority_opportunity", label: "Priority opportunity", agent: "sales", valueKind: "potential_pipeline", refType: "sales_opportunity", verifiable: true, description: "A specific high-value open estimate worth prioritizing. Refs: the estimate(s)." },
  { key: "capacity_opportunity", label: "Unused capacity", agent: "sales", valueKind: "capacity_value", refType: null, verifiable: true, description: "Empty or cancelled appointment slots from weekly numbers. No refs." },
  { key: "overdue_invoices", label: "Overdue invoices", agent: "finance", valueKind: "outstanding_balance", refType: "invoice", verifiable: true, description: "Unpaid invoices past due. Refs: the invoices." },
  { key: "customer_balance", label: "Customer balance risk", agent: "finance", valueKind: "outstanding_balance", refType: "invoice", verifiable: true, description: "One customer owes a large share of overdue money. Refs: that customer's unpaid invoices; subject: the customer name." },
  { key: "expense_increase", label: "Rising expense category", agent: "finance", valueKind: "expense_change", refType: "expense_category", verifiable: true, description: "An expense category whose recent monthly average rose. Ref: {type:'expense_category', id:<category name>}." },
  { key: "cash_risk", label: "Cash risk", agent: "finance", valueKind: "none", refType: null, verifiable: false, description: "Cash scenario shows a shortfall. Only when calculate_cash_scenario was available." },
  { key: "readiness_gap", label: "Readiness gap", agent: "readiness", valueKind: "none", refType: "capability", verifiable: true, description: "A capability can't run because information is missing. Ref: {type:'capability', id:<capability key>}." },
  { key: "data_quality", label: "Data quality", agent: "readiness", valueKind: "none", refType: null, verifiable: false, description: "Records are incomplete or inconsistent in a way that limits analysis." },
];

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key) as [string, ...string[]];

export function categoryDef(key: string): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.key === key);
}

export const STATUS_LABEL: Record<string, string> = {
  new: "New",
  needs_review: "Needs review",
  action_prepared: "Action prepared",
  in_progress: "In progress",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

export const VALUE_LABEL: Record<ValueKind, string> = {
  potential_pipeline: "Potential pipeline value",
  outstanding_balance: "Outstanding balance",
  expense_change: "Monthly cost increase",
  capacity_value: "Est. weekly unused value",
  none: "",
};
