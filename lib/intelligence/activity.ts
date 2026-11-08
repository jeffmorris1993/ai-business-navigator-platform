import "server-only";
import { db } from "../db/client";
import { formatMoney } from "../calc/money";

export type ActivityKind = "ai" | "software" | "owner";
export interface ActivityItem {
  id: string;
  at: string;
  kind: ActivityKind;
  actor: string; // agent key or "owner"/"software"
  title: string;
  detail?: string;
  href?: string;
}

const OWNER_EVENTS: Record<string, (p: Record<string, unknown>) => string | null> = {
  payment_recorded: (p) => `Recorded a ${formatMoney(Number(p.amount), { cents: true })} payment on invoice ${p.invoice_no}`,
  draft_approved: () => "Approved a message draft (not sent)",
  task_completed: () => "Completed a task",
  records_updated: (p) => (p.field === "last_contact_on" ? `Updated contact dates (${p.filled} added${p.unknown ? `, ${p.unknown} marked unknown` : ""})` : "Updated records"),
  data_imported: (p) => `Imported ${p.filename} (${p.inserted ?? 0} added, ${p.updated ?? 0} updated)`,
  manual_entry: (p) => `Entered weekly numbers for ${p.week_start}`,
  cash_entered: () => "Entered cash on hand",
  profile_updated: () => "Updated questionnaire answers",
};

/** One timeline that separates AI investigation, software analysis and owner actions. */
export async function loadActivity(businessId: string, limit = 25): Promise<ActivityItem[]> {
  const [scans, events, runs] = await Promise.all([
    db().from("intelligence_scans").select("*").eq("business_id", businessId).order("started_at", { ascending: false }).limit(limit),
    db().from("events").select("*").eq("business_id", businessId).order("created_at", { ascending: false }).limit(limit * 2),
    db().from("agent_runs").select("id,agent,question,status,started_at,scan_id").eq("business_id", businessId).is("scan_id", null).neq("model", "simulated").order("started_at", { ascending: false }).limit(10),
  ]);
  const items: ActivityItem[] = [];
  for (const s of scans.data ?? []) {
    const trig = { manual: "Started by you", import: "Started automatically after an import", follow_up: "Follow-up scan", software_only: "Software checks only (no AI)" }[s.trigger as string] ?? s.trigger;
    items.push({
      id: `scan-${s.id}`, at: s.started_at, kind: s.mode === "software_only" ? "software" : "ai", actor: s.mode === "software_only" ? "software" : "orchestrator",
      title: s.status === "running" ? "Intelligence scan running" : s.status === "failed" ? "Intelligence scan stopped before finishing" : `Intelligence scan: ${s.findings_new} new, ${s.findings_updated} updated, ${s.findings_resolved} resolved · ${s.drafts_prepared} drafts, ${s.tasks_created} tasks`,
      detail: s.status === "failed" ? `${trig}. ${s.error ?? ""}` : trig,
      href: `/activity?scan=${s.id}`,
    });
  }
  for (const r of runs.data ?? []) {
    items.push({ id: `run-${r.id}`, at: r.started_at, kind: "ai", actor: r.agent, title: `Asked: "${String(r.question).slice(0, 90)}"`, detail: r.status === "completed" ? "Answered with live tools" : r.status, href: `/activity?run=${r.id}` });
  }
  for (const e of events.data ?? []) {
    if (e.kind === "findings_revalidated") {
      items.push({ id: `ev-${e.id}`, at: e.created_at, kind: "software", actor: "software", title: `Software re-verified findings: ${e.payload.resolved} resolved, ${e.payload.updated} updated`, detail: String(e.payload.reason ?? "") });
    } else if (e.kind === "finding_resolved" && e.payload.by === "owner") {
      items.push({ id: `ev-${e.id}`, at: e.created_at, kind: "owner", actor: "owner", title: "Resolved a finding" });
    } else if (OWNER_EVENTS[e.kind]) {
      const t = OWNER_EVENTS[e.kind](e.payload);
      if (t) items.push({ id: `ev-${e.id}`, at: e.created_at, kind: "owner", actor: "owner", title: t });
    }
  }
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
