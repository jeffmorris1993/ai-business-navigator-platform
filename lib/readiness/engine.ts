import "server-only";
import { db, must } from "../db/client";
import * as repo from "../db/repo";
import { demoToday } from "../calc/dates";
import { assessAll, summarizeAreas, CAPABILITIES, type CapabilityResult, type CapabilityKey, type ReadinessStatus, type ReadinessInput, type FixAction } from "./rules";

const RANK: Record<ReadinessStatus, number> = { not_assessed: 0, needs_setup: 1, partial: 2, ready: 3 };

async function latestTimestamp(table: string, businessId: string, column = "created_at"): Promise<string | undefined> {
  const r = await db().from(table).select(column).eq("business_id", businessId).order(column, { ascending: false }).limit(1).maybeSingle();
  const v = (r.data as Record<string, string> | null)?.[column];
  return v ? v.slice(0, 10) : undefined;
}

export async function loadReadinessInput(businessId: string): Promise<ReadinessInput> {
  const [business, answers, opps, invoices, expenses, appointments, weeks, cash, sales, inv, exp, manual] = await Promise.all([
    repo.getBusiness(businessId),
    repo.getAnswers(businessId),
    repo.listOpportunities(businessId),
    repo.listInvoices(businessId),
    repo.listExpenses(businessId),
    repo.listAppointments(businessId),
    repo.listWeeks(businessId),
    repo.latestCash(businessId),
    latestTimestamp("sales_opportunities", businessId, "updated_at"),
    latestTimestamp("invoices", businessId, "updated_at"),
    latestTimestamp("expenses", businessId),
    latestTimestamp("manual_weekly_entries", businessId),
  ]);
  // In the demo, "now" is DEMO_TODAY; records created today in real time count as fresh.
  const asOf = demoToday();
  const fresh = (d?: string) => (d && d > asOf ? asOf : d);
  return { business, answers, opps, invoices, expenses, appointments, weeks, cash, lastUpdated: { sales: fresh(sales), invoices: fresh(inv), expenses: fresh(exp), manual: fresh(manual) }, asOf };
}

export interface StatusChange {
  capability: CapabilityKey;
  label: string;
  from: ReadinessStatus | null;
  to: ReadinessStatus;
  why: string;
}

const FIX_TASKS: Record<FixAction, { title: string; priority: "high" | "medium" | "low" }> = {
  add_last_contact_dates: { title: "Add last-contact dates to your open estimates", priority: "high" },
  upload_sales: { title: "Upload your sales or estimates spreadsheet", priority: "high" },
  resolve_statuses: { title: "Tell us what your unclear sales statuses mean", priority: "medium" },
  upload_invoices: { title: "Upload your invoice list", priority: "medium" },
  fix_invoice_balances: { title: "Upload invoices with the amount still owed", priority: "medium" },
  upload_expenses: { title: "Upload your expenses", priority: "low" },
  enter_cash: { title: "Enter your current cash on hand", priority: "low" },
  add_weekly_numbers: { title: "Enter this week's appointment numbers", priority: "medium" },
  answer_privacy: { title: "Answer two quick privacy questions", priority: "medium" },
};

export async function runAssessment(businessId: string, trigger: string) {
  const input = await loadReadinessInput(businessId);
  const results = assessAll(input);
  const prev = await getLatestStatuses(businessId);

  const assessment = must(await db().from("readiness_assessments").insert({ business_id: businessId, trigger }).select("id").single(), "Save assessment") as { id: string };
  must(
    await db().from("capability_status").insert(
      results.map((r) => ({ assessment_id: assessment.id, business_id: businessId, capability: r.capability, status: r.status, evidence: r.evidence, missing: r.missing, next_step: r.nextStep, fix_action: r.fixAction })),
    ),
    "Save capability status",
  );

  const changes: StatusChange[] = [];
  for (const r of results) {
    const before = prev.get(r.capability)?.status ?? null;
    if (before === r.status) continue;
    const label = CAPABILITIES.find((c) => c.key === r.capability)!.label;
    changes.push({ capability: r.capability, label, from: before, to: r.status, why: explainChange(r, before) });
    if (before && RANK[r.status] > RANK[before]) {
      await repo.logEvent(businessId, "record_quality_improved", { capability: r.capability, from: before, to: r.status, trigger });
    }
    if (r.status === "ready") await repo.logEvent(businessId, "capability_activated", { capability: r.capability, label, trigger });
  }
  await syncReadinessTasks(businessId, results);
  return { assessmentId: assessment.id, results, changes, trigger };
}

function explainChange(r: CapabilityResult, before: ReadinessStatus | null) {
  if (!before) return r.evidence[0] ?? "First check";
  if (r.status === "ready") return `Now verified: ${r.evidence.slice(0, 2).join("; ")}`;
  if (RANK[r.status] < RANK[before]) return r.missing[0] ?? "Information changed";
  return r.evidence.slice(0, 2).join("; ");
}

async function syncReadinessTasks(businessId: string, results: CapabilityResult[]) {
  const open = must(await db().from("tasks").select("id,title,status").eq("business_id", businessId).eq("source_agent", "readiness").in("status", ["open", "in_progress"]), "Load tasks") as Array<{ id: string; title: string }>;
  const neededFixes = new Map<string, { fix: FixAction; results: CapabilityResult[] }>();
  for (const r of results) {
    if (!r.fixAction || r.status === "ready" || r.status === "not_assessed") continue;
    const t = FIX_TASKS[r.fixAction];
    const entry = neededFixes.get(t.title) ?? { fix: r.fixAction, results: [] };
    entry.results.push(r);
    neededFixes.set(t.title, entry);
  }
  for (const [title, { fix, results: rs }] of neededFixes) {
    if (open.some((t) => t.title === title)) continue;
    await db().from("tasks").insert({
      business_id: businessId,
      source_agent: "readiness",
      priority: FIX_TASKS[fix].priority,
      title,
      explanation: `${rs.map((r) => r.nextStep).filter(Boolean)[0]} This unlocks: ${rs.map((r) => CAPABILITIES.find((c) => c.key === r.capability)!.label).join(", ")}.`,
      record_refs: [{ type: "fix_action", id: fix }],
    });
  }
  // Close readiness tasks whose requirement is now verified by the data.
  for (const t of open) {
    if (!neededFixes.has(t.title)) {
      await db().from("tasks").update({ status: "done", completed_at: new Date().toISOString(), explanation: "Completed: readiness check verified the information is now present." }).eq("id", t.id);
    }
  }
}

export async function getLatestStatuses(businessId: string) {
  const a = await db().from("readiness_assessments").select("id").eq("business_id", businessId).order("run_at", { ascending: false }).limit(1).maybeSingle();
  const map = new Map<CapabilityKey, { status: ReadinessStatus }>();
  if (!a.data) return map;
  const rows = must(await db().from("capability_status").select("capability,status").eq("assessment_id", a.data.id), "Load statuses") as Array<{ capability: CapabilityKey; status: ReadinessStatus }>;
  rows.forEach((r) => map.set(r.capability, { status: r.status }));
  return map;
}

export async function getReadinessReport(businessId: string) {
  const assessments = must(
    await db().from("readiness_assessments").select("id,trigger,run_at").eq("business_id", businessId).order("run_at", { ascending: true }),
    "Load history",
  ) as Array<{ id: string; trigger: string; run_at: string }>;
  if (!assessments.length) return null;
  const ids = assessments.map((a) => a.id);
  const statuses = must(await db().from("capability_status").select("*").in("assessment_id", ids), "Load statuses") as Array<{
    assessment_id: string; capability: CapabilityKey; status: ReadinessStatus; evidence: string[]; missing: string[]; next_step: string | null; fix_action: FixAction | null;
  }>;
  const byAssessment = new Map<string, typeof statuses>();
  statuses.forEach((s) => byAssessment.set(s.assessment_id, [...(byAssessment.get(s.assessment_id) ?? []), s]));
  const latest = assessments[assessments.length - 1];
  const current: CapabilityResult[] = (byAssessment.get(latest.id) ?? []).map((s) => ({
    capability: s.capability, status: s.status, evidence: s.evidence, missing: s.missing, nextStep: s.next_step, fixAction: s.fix_action,
  }));
  current.sort((a, b) => CAPABILITIES.findIndex((c) => c.key === a.capability) - CAPABILITIES.findIndex((c) => c.key === b.capability));
  const first = byAssessment.get(assessments[0].id) ?? [];
  // Timeline: each assessment with what changed from the one before.
  const timeline: Array<{ run_at: string; trigger: string; changes: StatusChange[] }> = [];
  let prevMap = new Map<CapabilityKey, ReadinessStatus>();
  for (const a of assessments) {
    const rows = byAssessment.get(a.id) ?? [];
    const changes: StatusChange[] = [];
    for (const r of rows) {
      const before = prevMap.get(r.capability) ?? null;
      if (before !== r.status && (before !== null || r.status !== "not_assessed")) {
        changes.push({ capability: r.capability, label: CAPABILITIES.find((c) => c.key === r.capability)!.label, from: before, to: r.status, why: r.status === "ready" ? r.evidence.slice(0, 2).join("; ") : r.missing[0] ?? r.evidence[0] ?? "" });
      }
    }
    if (changes.length) timeline.push({ run_at: a.run_at, trigger: a.trigger, changes });
    prevMap = new Map(rows.map((r) => [r.capability, r.status]));
  }
  const input = await loadReadinessInput(businessId);
  return {
    current,
    readyAtStart: first.filter((s) => s.status === "ready").map((s) => s.capability),
    timeline: timeline.reverse(),
    areas: summarizeAreas(input, current),
    lastRun: latest.run_at,
    assessments: assessments.length,
  };
}
