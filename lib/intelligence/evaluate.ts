// Pure, deterministic evaluation of findings against current records.
// Used to (1) validate what the AI records, (2) compute values, (3) re-verify and auto-resolve findings,
// (4) power the clearly labeled software-only mode.
import { daysBetween } from "../calc/dates";
import { sumMoney } from "../calc/money";
import { analyzeExpenses, findOverdueInvoices } from "../calc/finance";
import { analyzeAppointmentCapacity, findStaleOpportunities, findStalledProposals, DEFAULT_STALE_DAYS } from "../calc/sales";
import { RULES, assessAll, CAPABILITIES, type CapabilityKey, type ReadinessInput } from "../readiness/rules";
import { categoryDef, type RefType } from "./categories";

export interface FindingRef {
  type: RefType;
  id: string;
  label?: string;
}

export interface Evaluation {
  valid: boolean; // all refs exist for this business and match the category's record type
  invalidReason?: string;
  qualifying: FindingRef[]; // refs that still meet the category's condition right now
  stillApplies: boolean;
  value: number | null;
  subject: string | null;
  resolvedNote?: string; // plain-English reason when it no longer applies
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

export function evaluateFinding(category: string, refs: FindingRef[], subjectIn: string | null, d: ReadinessInput): Evaluation {
  const def = categoryDef(category);
  if (!def) return { valid: false, invalidReason: `Unknown category ${category}`, qualifying: [], stillApplies: false, value: null, subject: null };
  if (def.refType && refs.some((r) => r.type !== def.refType)) {
    return { valid: false, invalidReason: `${category} findings must reference ${def.refType} records`, qualifying: [], stillApplies: false, value: null, subject: null };
  }
  const asOf = d.asOf;
  const oppById = new Map(d.opps.map((o) => [o.id, o]));
  const invById = new Map(d.invoices.map((i) => [i.id, i]));

  switch (category) {
    case "stale_opportunities":
    case "stalled_proposals":
    case "priority_opportunity": {
      if (!refs.length) return invalid("Reference the estimates this finding is about");
      const missing = refs.filter((r) => !oppById.has(r.id));
      if (missing.length) return invalid("Some referenced estimates don't exist for this business");
      const q = refs.filter((r) => {
        const o = oppById.get(r.id)!;
        if (o.status !== "open") return false;
        if (category === "stale_opportunities") return Boolean(o.last_contact_on) && daysBetween(o.last_contact_on!, asOf) > DEFAULT_STALE_DAYS;
        if (category === "stalled_proposals") return Boolean(o.quoted_on) && daysBetween(o.quoted_on!, asOf) > 30;
        return true;
      });
      return {
        valid: true,
        qualifying: q.map((r) => ({ ...r, label: r.label ?? oppById.get(r.id)!.customer ?? undefined })),
        stillApplies: q.length > 0,
        value: sumMoney(q.map((r) => oppById.get(r.id)!.amount)),
        subject: null,
        resolvedNote: q.length ? undefined : category === "stale_opportunities" ? "Every referenced estimate was contacted in the last 7 days or is no longer open." : "Every referenced estimate is now won, lost or otherwise closed.",
      };
    }
    case "overdue_invoices":
    case "customer_balance": {
      if (!refs.length) return invalid("Reference the invoices this finding is about");
      if (refs.some((r) => !invById.has(r.id))) return invalid("Some referenced invoices don't exist for this business");
      const subject = category === "customer_balance" ? subjectIn ?? invById.get(refs[0].id)!.customer : null;
      if (category === "customer_balance" && refs.some((r) => norm(invById.get(r.id)!.customer) !== norm(subject))) {
        return invalid("Customer balance findings must reference invoices for a single customer");
      }
      const q = refs.filter((r) => {
        const i = invById.get(r.id)!;
        return (i.amount_due ?? 0) > 0 && Boolean(i.due_on) && daysBetween(i.due_on!, asOf) > 0;
      });
      return {
        valid: true,
        qualifying: q.map((r) => ({ ...r, label: r.label ?? `#${invById.get(r.id)!.invoice_no} ${invById.get(r.id)!.customer ?? ""}`.trim() })),
        stillApplies: q.length > 0,
        value: sumMoney(q.map((r) => invById.get(r.id)!.amount_due)),
        subject,
        resolvedNote: q.length ? undefined : "Every referenced invoice has been paid or is no longer overdue.",
      };
    }
    case "expense_increase": {
      const cat = subjectIn ?? refs[0]?.id;
      if (!cat) return invalid("Name the expense category");
      const a = analyzeExpenses(d.expenses, asOf);
      if (!a.sufficient) return { valid: true, qualifying: [], stillApplies: false, value: null, subject: cat, resolvedNote: "Not enough expense history to compare periods." };
      const row = a.categories.find((c) => norm(c.category) === norm(cat));
      if (!row) return invalid(`No expense category called "${cat}"`);
      const applies = row.change > 0 && (row.changePct == null || row.changePct >= 5);
      return {
        valid: true,
        qualifying: applies ? [{ type: "expense_category", id: row.category, label: row.category }] : [],
        stillApplies: applies,
        value: applies ? row.change : null,
        subject: row.category,
        resolvedNote: applies ? undefined : `${row.category} spending is no longer rising.`,
      };
    }
    case "readiness_gap": {
      const cap = (subjectIn ?? refs[0]?.id) as CapabilityKey | undefined;
      if (!cap || !RULES[cap]) return invalid("Reference a capability key");
      const r = RULES[cap](d);
      // A gap only counts if the capability is relevant and has a practical fix (e.g. appointment capacity for a roofer is not).
      const applies = r.status !== "ready" && r.fixAction != null;
      const label = CAPABILITIES.find((c) => c.key === cap)!.label;
      return {
        valid: true,
        qualifying: applies ? [{ type: "capability", id: cap, label }] : [],
        stillApplies: applies,
        value: null,
        subject: cap,
        resolvedNote: applies ? undefined : r.status === "ready" ? `${label} is now ready: the required information was verified.` : `${label} doesn't apply to this business right now.`,
      };
    }
    case "capacity_opportunity": {
      const c = analyzeAppointmentCapacity(d.weeks);
      const applies = c.weeks > 0 && c.totalUnusedSlots > 0;
      return { valid: true, qualifying: [], stillApplies: applies, value: c.avgWeeklyUnusedValue, subject: "weekly_capacity", resolvedNote: applies ? undefined : "No unused capacity in recent weeks." };
    }
    default:
      // cash_risk, data_quality: not auto-verifiable; the AI re-checks these on each scan.
      return { valid: true, qualifying: refs, stillApplies: true, value: null, subject: subjectIn ?? null };
  }

  function invalid(reason: string): Evaluation {
    return { valid: false, invalidReason: reason, qualifying: [], stillApplies: false, value: null, subject: null };
  }
}

/** Stable identity for de-duplication. Record-based findings also merge on overlapping records (see overlaps). */
export function dedupeKey(category: string, subject: string | null, refs: FindingRef[]): string {
  if (subject) return `${category}:${norm(subject)}`;
  if (refs.length === 1) return `${category}:${refs[0].id}`;
  return `${category}:group:${refs.map((r) => r.id).sort().join(",").slice(0, 400)}`;
}

/** Two record-based findings describe the same issue if they share at least half of the smaller set of records. */
export function overlaps(a: FindingRef[], b: FindingRef[]): boolean {
  if (!a.length || !b.length) return false;
  const sb = new Set(b.map((r) => r.id));
  const shared = a.filter((r) => sb.has(r.id)).length;
  return shared > 0 && shared >= Math.min(a.length, b.length) / 2;
}

export interface Candidate {
  category: string;
  agent: "readiness" | "sales" | "finance";
  title: string;
  explanation: string;
  priority: "critical" | "high" | "medium" | "low";
  refs: FindingRef[];
  subject: string | null;
  recommended_action: string;
}

/** Software-only detection (no AI). Clearly labeled in the UI; used when live AI is unavailable. */
export function softwareCandidates(d: ReadinessInput): Candidate[] {
  const out: Candidate[] = [];
  const results = assessAll(d);
  const ok = (k: CapabilityKey) => ["ready", "partial"].includes(results.find((r) => r.capability === k)!.status);
  if (ok("missed_followup")) {
    const s = findStaleOpportunities(d.opps, d.asOf);
    if (s.stale.length) {
      out.push({
        category: "stale_opportunities", agent: "sales", priority: s.stale.length >= 5 ? "high" : "medium",
        title: `${s.stale.length} open estimates have no contact in over 7 days`,
        explanation: "Detected by software: open estimates whose last recorded contact is more than 7 days ago.",
        refs: s.stale.map((x) => ({ type: "sales_opportunity", id: x.id, label: x.customer ?? undefined })), subject: null,
        recommended_action: "Review these estimates and follow up with the largest ones first.",
      });
    }
  }
  if (ok("sales_pipeline")) {
    const st = findStalledProposals(d.opps, d.asOf, 30);
    if (st.count) out.push({ category: "stalled_proposals", agent: "sales", priority: "medium", title: `${st.count} estimates have been open for more than 30 days`, explanation: "Detected by software from quote dates.", refs: st.proposals.map((p) => ({ type: "sales_opportunity", id: p.id, label: p.customer ?? undefined })), subject: null, recommended_action: "Decide whether to follow up or close these out." });
  }
  if (ok("overdue_invoices")) {
    const o = findOverdueInvoices(d.invoices, d.asOf);
    if (o.count) {
      out.push({ category: "overdue_invoices", agent: "finance", priority: o.overdue.some((x) => x.days_overdue > 30) ? "high" : "medium", title: `${o.count} invoices are past due`, explanation: "Detected by software: unpaid balances past their due date.", refs: o.overdue.map((x) => ({ type: "invoice", id: x.id, label: `#${x.invoice_no} ${x.customer ?? ""}`.trim() })), subject: null, recommended_action: "Send payment reminders, starting with the oldest balances." });
      const top = o.byCustomer[0];
      if (top && o.byCustomer.length > 1 && top.total >= o.total * 0.3) {
        out.push({ category: "customer_balance", agent: "finance", priority: "medium", title: `${top.customer} owes the largest overdue balance`, explanation: "Detected by software from overdue invoice balances.", refs: o.overdue.filter((x) => x.customer === top.customer).map((x) => ({ type: "invoice", id: x.id, label: `#${x.invoice_no}` })), subject: top.customer, recommended_action: "Contact this customer about their balance." });
      }
    }
  }
  if (ok("expense_trends")) {
    const a = analyzeExpenses(d.expenses, d.asOf);
    if (a.sufficient && a.categories[0] && a.categories[0].change > 0 && (a.categories[0].changePct ?? 100) >= 5) {
      const c = a.categories[0];
      out.push({ category: "expense_increase", agent: "finance", priority: (c.changePct ?? 0) >= 15 ? "high" : "medium", title: `${c.category} costs are rising`, explanation: "Detected by software: recent monthly average is higher than the earlier period.", refs: [{ type: "expense_category", id: c.category, label: c.category }], subject: c.category, recommended_action: "Review recent invoices from these vendors." });
    }
  }
  for (const r of results) {
    if ((r.status === "needs_setup" || r.status === "partial") && r.fixAction) {
      out.push({ category: "readiness_gap", agent: "readiness", priority: "low", title: `${CAPABILITIES.find((c) => c.key === r.capability)!.label} needs more information`, explanation: r.missing.join("; "), refs: [{ type: "capability", id: r.capability }], subject: r.capability, recommended_action: r.nextStep ?? "See My AI Readiness." });
    }
  }
  return out;
}
