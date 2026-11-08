import "server-only";
import { z } from "zod";
import { db, must } from "../db/client";
import * as repo from "../db/repo";
import { demoToday } from "../calc/dates";
import { liveAiAvailable, aiModel, LiveAiUnavailable } from "../ai/openai";
import { runAgent, openAiModelClient } from "../agents/run";
import { TOOLS, toolsFor } from "../agents/tools";
import { orchestratorPrompt, specialistPrompt, SCAN_OBJECTIVE } from "../agents/prompts";
import type { ToolDef } from "../agents/types";
import type { ModelClient, StepRecord } from "../agents/loop";
import { loadReadinessInput } from "../readiness/engine";
import { revalidateFindings, upsertFinding } from "./findings";
import { softwareCandidates } from "./evaluate";

export type ScanTrigger = "manual" | "import" | "follow_up" | "software_only";
type Specialist = "readiness" | "sales" | "finance";

export type ScanEvent =
  | { type: "scan"; scanId: string; trigger: ScanTrigger; mode: "ai" | "software_only"; model: string | null }
  | { type: "verification"; resolved: Array<{ title: string; note: string }>; updated: Array<{ title: string; note: string }> }
  | { type: "agent"; agent: string; phase: "start" | "done" | "failed"; focus?: string; summary?: string }
  | { type: "step"; agent: string; step: Pick<StepRecord, "step_no" | "kind" | "tool" | "output_summary" | "ok" | "duration_ms"> }
  | { type: "done"; scan: ScanSummary }
  | { type: "error"; error: string; scanId?: string };

export interface ScanSummary {
  id: string;
  status: "completed" | "failed";
  summary: string | null;
  findings_new: number;
  findings_updated: number;
  findings_resolved: number;
  drafts_prepared: number;
  tasks_created: number;
}

export class ScanBusy extends Error {
  constructor() {
    super("An intelligence scan is already running for this business. Wait for it to finish.");
  }
}

const STALE_SCAN_MINUTES = 6;
const SCAN_BUDGET_MS = 230_000;

/** Scans left "running" past the time limit were interrupted (e.g. the request was cut off). Mark them failed. */
export async function sweepStaleScans(businessId: string) {
  const cutoff = new Date(Date.now() - STALE_SCAN_MINUTES * 60_000).toISOString();
  await db().from("intelligence_scans").update({ status: "failed", error: "Interrupted before it finished.", finished_at: new Date().toISOString() }).eq("business_id", businessId).eq("status", "running").lt("started_at", cutoff);
}

function withAgent(t: ToolDef, agent: string): ToolDef {
  return t.agents.includes(agent as never) ? t : { ...t, agents: [...t.agents, agent as never] };
}

function specialistTools(agent: Specialist): ToolDef[] {
  // Sensitive tools (payments, approvals, record edits) are never available during an automated scan.
  return toolsFor(agent).filter((t) => !t.sensitive && t.name !== "reassess_readiness");
}

export async function runScan(opts: { businessId: string; trigger: ScanTrigger; scopeHint?: string | null; scope?: string[]; onEvent?: (e: ScanEvent) => void; model?: ModelClient }) {
  const emit = (e: ScanEvent) => { try { opts.onEvent?.(e); } catch {} };
  const softwareOnly = opts.trigger === "software_only";
  if (!softwareOnly && !opts.model && !liveAiAvailable()) throw new LiveAiUnavailable();
  await sweepStaleScans(opts.businessId);

  const ins = await db().from("intelligence_scans").insert({
    business_id: opts.businessId, trigger: opts.trigger, scope: opts.scope ?? [], mode: softwareOnly ? "software_only" : "ai",
    objective: SCAN_OBJECTIVE, model: softwareOnly ? null : opts.model?.name ?? aiModel(),
  }).select("id,started_at").single();
  if (ins.error) {
    if (/duplicate key|intelligence_scans_one_running/i.test(ins.error.message)) throw new ScanBusy();
    throw new Error(ins.error.message);
  }
  const scanId = ins.data.id as string;
  const startedAt = ins.data.started_at as string;
  emit({ type: "scan", scanId, trigger: opts.trigger, mode: softwareOnly ? "software_only" : "ai", model: softwareOnly ? null : opts.model?.name ?? aiModel() });

  let softwareResolved = 0;
  try {
    // Step 1 (software): re-verify earlier findings against current records.
    const v = await revalidateFindings(opts.businessId, "Intelligence scan started");
    softwareResolved = v.resolved.length;
    emit({ type: "verification", resolved: v.resolved, updated: v.updated });

    let summary: string | null = null;
    if (softwareOnly) {
      const d = await loadReadinessInput(opts.businessId);
      const cands = softwareCandidates(d);
      for (const c of cands) {
        const r = await upsertFinding(opts.businessId, { ...c, agent: "software", subject: c.subject, record_refs: c.refs, evidence_quality: "verified_records", scanId }, d);
        emit({ type: "step", agent: "software", step: { step_no: 0, kind: "tool_call", tool: "software_check", output_summary: r.ok ? `${r.outcome === "created" ? "Detected" : "Re-confirmed"}: ${c.title}` : `Skipped: ${r.error}`, ok: r.ok, duration_ms: 0 } });
      }
      summary = `Software checks only (no AI investigation): ${cands.length} issue(s) detected from your records.`;
    } else {
      summary = await runAiScan(opts.businessId, scanId, opts, emit);
    }

    const counts = await scanCounts(opts.businessId, scanId, startedAt, softwareResolved);
    const final = { status: "completed" as const, summary, ...counts };
    await db().from("intelligence_scans").update({ ...final, finished_at: new Date().toISOString() }).eq("id", scanId);
    await repo.logEvent(opts.businessId, "intelligence_scan", { scanId, trigger: opts.trigger, ...counts });
    const done: ScanSummary = { id: scanId, ...final };
    emit({ type: "done", scan: done });
    return done;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Scan failed";
    const counts = await scanCounts(opts.businessId, scanId, startedAt, softwareResolved).catch(() => ({}));
    await db().from("intelligence_scans").update({ status: "failed", error: msg.slice(0, 500), finished_at: new Date().toISOString(), ...counts }).eq("id", scanId);
    emit({ type: "error", error: /api key|401|quota/i.test(msg) ? "The AI service rejected the request. Check the OpenAI API key and quota." : `The scan stopped: ${msg}`, scanId });
    throw e;
  }
}

async function runAiScan(businessId: string, scanId: string, opts: { trigger: ScanTrigger; scopeHint?: string | null; model?: ModelClient }, emit: (e: ScanEvent) => void) {
  const model = opts.model ?? openAiModelClient();
  const business = await repo.getBusiness(businessId);
  const today = demoToday();
  const dispatched: Record<string, number> = {};

  const delegateInput = z.object({ agent: z.enum(["readiness", "sales", "finance"]), focus: z.string().min(10).max(800).describe("What this specialist should look into and why") });
  const delegate: ToolDef<typeof delegateInput> = {
    name: "delegate_investigation",
    description: "Dispatch a specialist agent (readiness, sales or finance) to investigate a specific focus. It uses its own tools, records findings and prepares drafts/tasks, then reports back. Call several in one turn to run them in parallel.",
    input: delegateInput,
    agents: ["orchestrator"],
    timeoutMs: 180_000,
    async run(ctx, { agent, focus }) {
      dispatched[agent] = (dispatched[agent] ?? 0) + 1;
      if (dispatched[agent] > 2) throw new Error(`The ${agent} specialist was already dispatched twice in this scan.`);
      emit({ type: "agent", agent, phase: "start", focus });
      try {
        const r = await runAgent({
          businessId, agent, question: `Investigate: ${focus}`, model, tools: specialistTools(agent),
          system: specialistPrompt(agent, business, today, focus, 3), maxIterations: 10, deadlineMs: 140_000,
          scanId, parentRunId: ctx.runId, noConversation: true,
          onStep: (s) => emit({ type: "step", agent, step: { step_no: s.step_no, kind: s.kind, tool: s.tool, output_summary: s.output_summary, ok: s.ok, duration_ms: s.duration_ms } }),
        });
        const recorded = r.toolResults.filter((t) => t.tool === "record_finding").map((t) => t.data);
        const prepared = r.toolResults.filter((t) => ["draft_sales_followup", "draft_payment_reminder", "create_task", "prepare_draft"].includes(t.tool)).length;
        emit({ type: "agent", agent, phase: "done", summary: r.answer });
        return { summary: `${agent[0].toUpperCase()}${agent.slice(1)} specialist finished: ${recorded.length} finding(s) recorded, ${prepared} item(s) prepared`, data: { report: r.answer, findings: recorded, prepared, stopped_early: r.stoppedEarly } };
      } catch (e) {
        emit({ type: "agent", agent, phase: "failed", summary: e instanceof Error ? e.message : "failed" });
        throw e;
      }
    },
  };

  const orient = ["get_business_profile", "inspect_business_data", "assess_capability_readiness", "identify_missing_fields", "list_open_findings", "get_finding", "prioritize_findings"];
  const tools: ToolDef[] = [...TOOLS.filter((t) => orient.includes(t.name)).map((t) => withAgent(t, "orchestrator")), delegate as unknown as ToolDef];
  emit({ type: "agent", agent: "orchestrator", phase: "start" });
  const r = await runAgent({
    businessId, agent: "orchestrator", model, tools,
    question: opts.scopeHint ? `${SCAN_OBJECTIVE}\n\nTrigger: ${opts.scopeHint}` : SCAN_OBJECTIVE,
    system: orchestratorPrompt(business, today, opts.scopeHint ?? null),
    maxIterations: 7, deadlineMs: SCAN_BUDGET_MS, scanId, noConversation: true,
    onStep: (s) => emit({ type: "step", agent: "orchestrator", step: { step_no: s.step_no, kind: s.kind, tool: s.tool, output_summary: s.output_summary, ok: s.ok, duration_ms: s.duration_ms } }),
  });
  emit({ type: "agent", agent: "orchestrator", phase: "done", summary: r.answer });
  if (!Object.keys(dispatched).length) throw new Error("The coordinator finished without dispatching any specialist.");
  return r.answer;
}

async function scanCounts(businessId: string, scanId: string, startedAt: string, softwareResolved: number) {
  const runs = (must(await db().from("agent_runs").select("id").eq("scan_id", scanId), "Runs") as Array<{ id: string }>).map((r) => r.id);
  const [created, updated, resolvedAi, drafts, tasks] = await Promise.all([
    db().from("findings").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("source_scan_id", scanId),
    runs.length ? db().from("findings").select("id", { count: "exact", head: true }).eq("business_id", businessId).in("updated_by_run_id", runs).neq("source_scan_id", scanId) : Promise.resolve({ count: 0 }),
    db().from("findings").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("resolved_by", "ai_scan").gte("resolved_at", startedAt),
    db().from("drafts").select("id", { count: "exact", head: true }).eq("business_id", businessId).not("finding_id", "is", null).gte("updated_at", startedAt),
    db().from("tasks").select("id", { count: "exact", head: true }).eq("business_id", businessId).not("finding_id", "is", null).gte("created_at", startedAt),
  ]);
  return {
    findings_new: created.count ?? 0,
    findings_updated: updated.count ?? 0,
    findings_resolved: softwareResolved + (resolvedAi.count ?? 0),
    drafts_prepared: drafts.count ?? 0,
    tasks_created: tasks.count ?? 0,
  };
}

export async function latestScan(businessId: string) {
  await sweepStaleScans(businessId);
  const r = await db().from("intelligence_scans").select("*").eq("business_id", businessId).order("started_at", { ascending: false }).limit(1).maybeSingle();
  return r.data as (Omit<ScanSummary, "status"> & { trigger: string; mode: string; started_at: string; finished_at: string | null; error: string | null; model: string | null; status: string }) | null;
}
