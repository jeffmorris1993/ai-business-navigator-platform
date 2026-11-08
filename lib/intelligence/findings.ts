import "server-only";
import { db, must } from "../db/client";
import { loadReadinessInput } from "../readiness/engine";
import { logEvent } from "../db/repo";
import { categoryDef, type FindingAgent } from "./categories";
import { evaluateFinding, dedupeKey, overlaps, FAMILIES, sharesRecords, isSubset, type FindingRef } from "./evaluate";
import type { ReadinessInput } from "../readiness/rules";

export interface FindingRow {
  id: string;
  business_id: string;
  agent: FindingAgent;
  category: string;
  title: string;
  explanation: string;
  priority: "critical" | "high" | "medium" | "low";
  record_refs: FindingRef[];
  subject: string | null;
  value: number | null;
  value_kind: string;
  evidence_quality: string;
  recommended_action: string | null;
  status: string;
  dedupe_key: string;
  resolution_note: string | null;
  resolved_by: string | null;
  dismissed_reason: string | null;
  source_scan_id: string | null;
  source_run_id: string | null;
  updated_by_run_id: string | null;
  times_verified: number;
  created_at: string;
  last_verified_at: string;
  resolved_at: string | null;
}

const OPEN = ["new", "needs_review", "action_prepared", "in_progress"];
const num = (v: unknown) => (v == null ? null : Number(v));

function normalize(r: FindingRow): FindingRow {
  return { ...r, value: num(r.value) };
}

export async function listFindings(businessId: string, opts: { open?: boolean; limit?: number } = {}): Promise<FindingRow[]> {
  let q = db().from("findings").select("*").eq("business_id", businessId);
  if (opts.open) q = q.in("status", OPEN);
  const rows = must(await q.order("created_at", { ascending: false }).limit(opts.limit ?? 200), "Load findings") as FindingRow[];
  return rows.map(normalize);
}

export async function getFinding(businessId: string, id: string): Promise<FindingRow | null> {
  const r = await db().from("findings").select("*").eq("business_id", businessId).eq("id", id).maybeSingle();
  return r.data ? normalize(r.data as FindingRow) : null;
}

export interface UpsertInput {
  agent: Exclude<FindingAgent, "software"> | "software";
  category: string;
  title: string;
  explanation: string;
  priority: FindingRow["priority"];
  record_refs: FindingRef[];
  subject?: string | null;
  evidence_quality?: string;
  recommended_action?: string | null;
  scanId?: string | null;
  runId?: string | null;
}

export type UpsertResult =
  | { ok: true; id: string; outcome: "created" | "updated"; value: number | null; value_kind: string; qualifyingRefs: number; covered?: boolean }
  | { ok: false; error: string };

/**
 * Save a finding. Software validates every reference against this business's records, computes the value,
 * and merges with an existing open finding describing the same issue instead of creating a duplicate.
 */
export async function upsertFinding(businessId: string, input: UpsertInput, data?: ReadinessInput): Promise<UpsertResult> {
  const def = categoryDef(input.category);
  if (!def) return { ok: false, error: `Unknown category "${input.category}".` };
  const d = data ?? (await loadReadinessInput(businessId));
  const ev = evaluateFinding(input.category, input.record_refs ?? [], input.subject ?? null, d);
  if (!ev.valid) return { ok: false, error: ev.invalidReason ?? "Invalid finding" };
  if (!ev.stillApplies) return { ok: false, error: `The records don't support this finding right now: ${ev.resolvedNote ?? "condition not met"}. Don't record it.` };
  const refsIn = def.refType ? ev.qualifying : input.record_refs ?? [];
  const key = dedupeKey(input.category, ev.subject, refsIn);

  const family = FAMILIES[input.category] ?? [input.category];
  const open = (must(await db().from("findings").select("*").eq("business_id", businessId).in("category", family).in("status", OPEN), "Open findings") as FindingRow[]).map(normalize);
  const same = open.filter((f) => f.category === input.category);
  let refs = refsIn;
  const match =
    same.find((f) => f.dedupe_key === key) ??
    (ev.subject ? undefined : def.refType ? open.find((f) => overlaps(f.record_refs, refs)) ?? open.find((f) => sharesRecords(f.record_refs, refs)) : undefined) ??
    (!def.refType && !ev.subject ? same[0] : undefined);

  // A narrower restatement of an issue that's already open (e.g. one customer from an existing group) is "covered":
  // keep the existing finding, just mark it verified again.
  if (match && def.refType && isSubset(refs, match.record_refs) && match.record_refs.length > refs.length) {
    await db().from("findings").update({ last_verified_at: new Date().toISOString(), updated_by_run_id: input.runId ?? null, times_verified: match.times_verified + 1, status: match.status === "needs_review" ? "new" : match.status }).eq("id", match.id);
    return { ok: true, id: match.id, outcome: "updated", value: match.value, value_kind: match.value_kind, qualifyingRefs: match.record_refs.length, covered: true };
  }
  let value = ev.value;
  let category = input.category;
  if (match && def.refType && match.category !== input.category && !isSubset(match.record_refs, refs)) {
    // Overlapping but broader in both directions: merge the record sets and recompute from records.
    const union = [...new Map([...match.record_refs, ...refs].map((r) => [r.id, r])).values()];
    const ev2 = evaluateFinding(input.category, union, null, d);
    if (ev2.valid && ev2.stillApplies) { refs = ev2.qualifying; value = ev2.value; }
  }
  if (match && match.category !== input.category && def.refType && isSubset(match.record_refs, refs)) category = input.category;
  const finalKey = dedupeKey(category, ev.subject, refs);

  const fields = {
    agent: input.agent,
    title: input.title.slice(0, 200),
    explanation: input.explanation.slice(0, 3000),
    priority: input.priority,
    record_refs: refs,
    subject: ev.subject,
    value,
    value_kind: def.valueKind,
    evidence_quality: input.evidence_quality ?? "verified_records",
    recommended_action: input.recommended_action?.slice(0, 600) ?? null,
    dedupe_key: finalKey,
    category,
  };

  if (match) {
    const res = await db().from("findings").update({
      ...fields,
      status: match.status === "needs_review" ? "new" : match.status,
      last_verified_at: new Date().toISOString(),
      updated_by_run_id: input.runId ?? null,
      times_verified: match.times_verified + 1,
    }).eq("id", match.id).select("id").single();
    if (res.error) return { ok: false, error: res.error.message };
    return { ok: true, id: match.id, outcome: "updated", value, value_kind: def.valueKind, qualifyingRefs: refs.length };
  }
  const res = await db().from("findings").insert({
    business_id: businessId, status: "new", ...fields,
    source_scan_id: input.scanId ?? null, source_run_id: input.runId ?? null, updated_by_run_id: input.runId ?? null,
  }).select("id").single();
  if (res.error) {
    // Race with a parallel specialist recording the same issue: fall back to update.
    if (/duplicate key/i.test(res.error.message)) return upsertFinding(businessId, input, d);
    return { ok: false, error: res.error.message };
  }
  return { ok: true, id: res.data!.id as string, outcome: "created", value, value_kind: def.valueKind, qualifyingRefs: refs.length };
}

export async function resolveFinding(businessId: string, id: string, by: "software_verified" | "ai_scan" | "owner", note: string) {
  const r = must(await db().from("findings").update({ status: "resolved", resolved_by: by, resolution_note: note.slice(0, 500), resolved_at: new Date().toISOString() }).eq("id", id).eq("business_id", businessId).in("status", OPEN).select("id"), "Resolve finding") as unknown[];
  if (r.length) {
    await logEvent(businessId, "finding_resolved", { id, by });
    if (by === "software_verified") {
      // The underlying issue is gone, so open tasks for it are done too.
      await db().from("tasks").update({ status: "done", completed_at: new Date().toISOString(), explanation: `Closed automatically: ${note.slice(0, 300)}` }).eq("business_id", businessId).eq("finding_id", id).in("status", ["open", "in_progress"]);
    }
  }
  return r.length > 0;
}

export async function dismissFinding(businessId: string, id: string, reason: string) {
  if (!reason.trim()) throw new Error("Please give a reason for dismissing.");
  const r = must(await db().from("findings").update({ status: "dismissed", dismissed_reason: reason.slice(0, 500), resolved_by: "owner", resolved_at: new Date().toISOString() }).eq("id", id).eq("business_id", businessId).select("id"), "Dismiss") as unknown[];
  return r.length > 0;
}

export async function setFindingStatus(businessId: string, id: string, status: "in_progress" | "needs_review" | "new") {
  must(await db().from("findings").update({ status }).eq("id", id).eq("business_id", businessId).in("status", OPEN), "Update finding");
}

/**
 * Re-check every open finding against current records (deterministic). Resolves findings that no longer apply,
 * updates values and references when they partly changed, and rolls status up from linked work.
 */
export async function revalidateFindings(businessId: string, reason = "Records changed") {
  const open = (must(await db().from("findings").select("*").eq("business_id", businessId).in("status", OPEN), "Open findings") as FindingRow[]).map(normalize);
  if (!open.length) return { checked: 0, resolved: [] as Array<{ id: string; title: string; note: string }>, updated: [] as Array<{ id: string; title: string; note: string }> };
  const d = await loadReadinessInput(businessId);
  const resolved: Array<{ id: string; title: string; note: string }> = [];
  const updated: Array<{ id: string; title: string; note: string }> = [];
  for (const f of open) {
    const def = categoryDef(f.category);
    if (!def?.verifiable) continue;
    const ev = evaluateFinding(f.category, f.record_refs, f.subject, d);
    if (!ev.valid || !ev.stillApplies) {
      const note = ev.valid ? ev.resolvedNote ?? "No longer applies." : "Referenced records were removed.";
      await resolveFinding(businessId, f.id, "software_verified", `${note} (${reason})`);
      resolved.push({ id: f.id, title: f.title, note });
      continue;
    }
    const refsChanged = def.refType ? ev.qualifying.length !== f.record_refs.length : false;
    const valueChanged = (ev.value ?? null) !== (f.value ?? null);
    if (refsChanged || valueChanged) {
      const note = refsChanged ? `${f.record_refs.length - ev.qualifying.length} of ${f.record_refs.length} records no longer qualify; value recalculated.` : "Value recalculated from current records.";
      await db().from("findings").update({
        record_refs: def.refType ? ev.qualifying : f.record_refs,
        value: ev.value,
        status: f.status === "in_progress" ? "in_progress" : "needs_review",
        resolution_note: note,
        last_verified_at: new Date().toISOString(),
      }).eq("id", f.id);
      updated.push({ id: f.id, title: f.title, note });
    } else {
      await db().from("findings").update({ last_verified_at: new Date().toISOString() }).eq("id", f.id);
    }
  }
  await rollupStatuses(businessId);
  if (resolved.length || updated.length) await logEvent(businessId, "findings_revalidated", { resolved: resolved.length, updated: updated.length, reason });
  return { checked: open.length, resolved, updated };
}

/** new → action_prepared when a draft or task is linked; → in_progress when a linked task is in progress. */
export async function rollupStatuses(businessId: string) {
  const open = must(await db().from("findings").select("id,status").eq("business_id", businessId).in("status", ["new", "action_prepared", "needs_review"]), "Rollup") as Array<{ id: string; status: string }>;
  if (!open.length) return;
  const ids = open.map((f) => f.id);
  const [drafts, tasks] = await Promise.all([
    db().from("drafts").select("finding_id").in("finding_id", ids),
    db().from("tasks").select("finding_id,status").in("finding_id", ids),
  ]);
  for (const f of open) {
    const t = (tasks.data ?? []).filter((x) => x.finding_id === f.id);
    const hasWork = (drafts.data ?? []).some((x) => x.finding_id === f.id) || t.length > 0;
    const next = t.some((x) => x.status === "in_progress") ? "in_progress" : hasWork && f.status === "new" ? "action_prepared" : f.status;
    if (next !== f.status) await db().from("findings").update({ status: next }).eq("id", f.id);
  }
}
