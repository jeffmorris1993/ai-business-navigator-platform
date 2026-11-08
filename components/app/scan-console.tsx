"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Play, RefreshCcw, Loader2, Check, X, ArrowRight, Cpu, ShieldCheck, ChevronDown, Sparkles, Mail, ListChecks, CircleAlert, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgentGlyph, AGENT_META } from "./status";
import type { LaneState, RosterScan, ScanBroadcast } from "./agent-roster";
import { cn } from "@/lib/utils";

/* ============================ Stream state ============================ */
export interface ScanStep { agent: string; kind: "model_call" | "tool_call"; tool?: string; output_summary: string; ok: boolean; t: number }
interface AgentLane { agent: string; status: "running" | "done" | "failed"; focus?: string; summary?: string }
interface ScanDone { id: string; status: string; summary: string | null; findings_new: number; findings_updated: number; findings_resolved: number; drafts_prepared: number; tasks_created: number }
export interface ScanState {
  running: boolean;
  mode?: "ai" | "software_only";
  model?: string | null;
  steps: ScanStep[];
  lanes: AgentLane[];
  verification?: { resolved: Array<{ title: string; note: string }>; updated: Array<{ title: string; note: string }> };
  done?: ScanDone;
  error?: string;
  startedAt?: number;
  endedAt?: number;
}
const EMPTY: ScanState = { running: false, steps: [], lanes: [] };
const SPECIALISTS = ["readiness", "sales", "finance"] as const;

/** Reads an NDJSON scan stream (scan endpoint or import endpoint) into UI state. Only real events change state. */
export function useScanStream() {
  const [state, setState] = useState<ScanState>(EMPTY);
  const consume = useCallback(async (res: Response, onOther?: (ev: Record<string, unknown>) => void) => {
    const t0 = Date.now();
    setState({ ...EMPTY, running: true, startedAt: t0 });
    if (!res.ok || !res.body) {
      const j = await res.json().catch(() => ({}));
      setState({ ...EMPTY, error: j.error ?? "The scan couldn't start." });
      return;
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let sawScan = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const ev = JSON.parse(line);
        const t = (Date.now() - t0) / 1000;
        if (ev.type === "scan") { sawScan = true; setState((s) => ({ ...s, mode: ev.mode, model: ev.model })); }
        else if (ev.type === "verification") setState((s) => ({ ...s, verification: { resolved: ev.resolved, updated: ev.updated } }));
        else if (ev.type === "agent") setState((s) => {
          const prev = s.lanes.find((l) => l.agent === ev.agent);
          const others = s.lanes.filter((l) => l.agent !== ev.agent);
          return { ...s, lanes: [...others, { agent: ev.agent, status: ev.phase === "start" ? "running" : ev.phase, focus: ev.focus ?? prev?.focus, summary: ev.summary }] };
        });
        else if (ev.type === "step") setState((s) => ({ ...s, steps: [...s.steps, { agent: ev.agent, kind: ev.step.kind, tool: ev.step.tool, output_summary: ev.step.output_summary, ok: ev.step.ok, t }] }));
        else if (ev.type === "done") setState((s) => ({ ...s, running: false, done: ev.scan, endedAt: Date.now() }));
        else if (ev.type === "error") setState((s) => ({ ...s, running: false, error: ev.error, endedAt: Date.now() }));
        else onOther?.(ev);
      }
    }
    setState((s) => (s.running ? { ...s, running: false, endedAt: Date.now(), error: sawScan ? s.error ?? "The connection closed before the scan finished. It will show as interrupted." : s.error } : s));
  }, []);
  const start = useCallback(async (opts: { followUp?: boolean; softwareOnly?: boolean } = {}) => {
    const res = await fetch("/api/intelligence/scan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ followUp: opts.followUp, mode: opts.softwareOnly ? "software_only" : undefined }) });
    await consume(res);
  }, [consume]);
  return { state, start, consume, reset: () => setState(EMPTY) };
}

/* ============================ Derived view model ============================ */
function laneStates(s: ScanState): Record<string, LaneState> {
  const out: Record<string, LaneState> = {};
  const orch = s.lanes.find((l) => l.agent === "orchestrator");
  const coordinatorFinished = orch?.status === "done" || orch?.status === "failed" || Boolean(s.done) || Boolean(s.error);
  out.orchestrator = s.mode === "software_only" ? "skipped" : orch ? (orch.status === "running" ? "working" : orch.status) : s.running ? "working" : s.done ? "done" : "idle";
  for (const a of SPECIALISTS) {
    const l = s.lanes.find((x) => x.agent === a);
    if (l) out[a] = l.status === "running" ? "working" : l.status;
    else out[a] = coordinatorFinished ? "skipped" : s.running ? "standby" : "idle";
  }
  return out;
}

const STAGES = [
  { key: "verify", label: "Verify" },
  { key: "orient", label: "Orient" },
  { key: "dispatch", label: "Dispatch" },
  { key: "investigate", label: "Investigate" },
  { key: "prioritize", label: "Prioritize" },
  { key: "brief", label: "Brief" },
] as const;

function reachedStages(s: ScanState) {
  const firstSpecialistStep = s.steps.findIndex((x) => SPECIALISTS.includes(x.agent as never));
  const orientSteps = s.steps.filter((x, i) => x.agent === "orchestrator" && x.kind === "tool_call" && x.tool !== "delegate_investigation" && (firstSpecialistStep === -1 || i < firstSpecialistStep));
  return {
    verify: Boolean(s.verification),
    orient: orientSteps.length > 0 || s.mode === "software_only",
    dispatch: s.lanes.some((l) => SPECIALISTS.includes(l.agent as never)),
    investigate: firstSpecialistStep !== -1 || (s.mode === "software_only" && s.steps.length > 0),
    prioritize: s.steps.some((x) => x.tool === "prioritize_findings" && x.ok),
    brief: Boolean(s.done),
  } as Record<(typeof STAGES)[number]["key"], boolean>;
}

type CardKind = "decision" | "tool" | "finding" | "draft" | "task" | "resolved" | "issue";
function classify(st: ScanStep): CardKind {
  if (st.kind === "model_call") return "decision";
  if (!st.ok) return "issue";
  if (st.tool === "record_finding" || st.tool === "software_check") return "finding";
  if (st.tool?.startsWith("draft_") || st.tool === "prepare_draft") return "draft";
  if (st.tool === "create_task") return "task";
  if (st.tool === "resolve_finding") return "resolved";
  return "tool";
}

/* ============================ Signal panel (idle control) ============================ */
export function useScanController(liveAi: boolean) {
  const stream = useScanStream();
  const params = useSearchParams();
  const router = useRouter();
  const auto = useRef(false);
  useEffect(() => {
    const p = params.get("scan");
    if (!p || auto.current || !liveAi) return;
    auto.current = true;
    router.replace("/overview", { scroll: false });
    stream.start({ followUp: p === "followup" }).then(() => router.refresh());
  }, [params, liveAi, stream, router]);
  const run = useCallback(async (o: { followUp?: boolean; softwareOnly?: boolean }) => { await stream.start(o); router.refresh(); }, [stream, router]);
  // Broadcast real lane states to the navigation rail.
  useEffect(() => {
    const visible = stream.state.running || stream.state.done || stream.state.error;
    if (!visible) return;
    window.dispatchEvent(new CustomEvent<ScanBroadcast>("sirrom:scan", { detail: { running: stream.state.running, agents: laneStates(stream.state) } }));
  }, [stream.state]);
  return { ...stream, run };
}

/** Briefing band: editorial content on the left, midnight signal panel on the right, live investigation below. */
export function IntelligenceBriefing({ children, liveAi, hasPriorScan, lastScan }: { children: React.ReactNode; liveAi: boolean; hasPriorScan: boolean; lastScan: (RosterScan & { trigger?: string; findings_new?: number }) | null }) {
  const c = useScanController(liveAi);
  const s = c.state;
  const active = s.running || Boolean(s.done) || Boolean(s.error);
  const lanes = laneStates(s);
  return (
    <section aria-label="Intelligence briefing">
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_400px] xl:gap-12">
        <div className="min-w-0">{children}</div>
        <div className="on-dark relative overflow-hidden rounded-panel bg-midnight p-6 text-night ring-1 ring-midnight-line">
          <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full border border-white/[0.04]" />
          <div className="pointer-events-none absolute -right-6 -top-6 size-32 rounded-full border border-white/[0.05]" />
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-night-3">Intelligence Engine</span>
            <span className={cn("flex items-center gap-1.5 text-[12px]", s.running ? "text-lime" : liveAi ? "text-night-2" : "text-night-3")}>
              <span className={cn("size-1.5 rounded-full", s.running ? "bg-lime animate-ring" : liveAi ? "bg-teal" : "bg-night-3")} />
              {s.running ? "Investigating" : liveAi ? "Ready" : "AI unavailable"}
            </span>
          </div>
          <p className="mt-4 font-display text-[22px] leading-snug text-white">
            {s.running ? "Your agents are investigating this business." : liveAi ? "Dispatch your agents to investigate and prepare work." : "Live AI is unavailable."}
          </p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-night-2">
            {liveAi ? "The coordinator reviews your records, sends the Readiness, Sales and Financial agents where they're needed, and saves evidence-backed findings and drafts for your approval." : "No OpenAI key is configured on the server, so no AI investigation can run. Software checks are available and clearly labeled."}
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto]">
            {liveAi ? (
              <>
                <Button variant="signal" size="lg" onClick={() => c.run({})} disabled={s.running}>
                  {s.running ? <Loader2 className="animate-spin" /> : <Play />} {s.running ? "Investigating…" : "Run AI Intelligence Scan"}
                </Button>
                {hasPriorScan && <Button variant="night" size="lg" onClick={() => c.run({ followUp: true })} disabled={s.running}><RefreshCcw /> Follow-up</Button>}
              </>
            ) : (
              <Button variant="night" size="lg" onClick={() => c.run({ softwareOnly: true })} disabled={s.running}><Cpu /> Run software checks only</Button>
            )}
          </div>
          <ul className="mt-6 grid grid-cols-4 gap-2 border-t border-midnight-line pt-5">
            {(["orchestrator", ...SPECIALISTS] as const).map((a) => (
              <li key={a} className="flex flex-col items-center gap-1.5 text-center">
                <span className={cn("rounded-[8px] p-0.5 transition-all", lanes[a] === "working" && "ring-2 ring-lime/70")}><AgentGlyph agent={a} size={30} onDark /></span>
                <span className="text-[11.5px] text-night">{AGENT_META[a].short}</span>
                <span className={cn("text-[10.5px]", lanes[a] === "working" ? "text-lime" : lanes[a] === "failed" ? "text-red" : "text-night-3")}>{liveAi ? { idle: "Ready", standby: "Standing by", working: "Working", done: "Done", failed: "Stopped", skipped: "Not needed" }[lanes[a]] : "Offline"}</span>
              </li>
            ))}
          </ul>
          {!active && lastScan && (
            <p className="mt-4 text-[12px] text-night-3">Last scan {new Date(lastScan.started_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {lastScan.status === "completed" ? "completed" : lastScan.status === "running" ? "running" : "stopped before finishing"}</p>
          )}
        </div>
      </div>
      {active && <div className="mt-10"><ScanStage state={s} /></div>}
    </section>
  );
}

/* ============================ Live investigation stage ============================ */
export function ScanStage({ state: s, compact }: { state: ScanState; compact?: boolean }) {
  const lanes = laneStates(s);
  const reached = reachedStages(s);
  const currentIdx = (() => { let i = -1; STAGES.forEach((st, n) => { if (reached[st.key]) i = n; }); return i; })();
  const [showAll, setShowAll] = useState(false);
  const elapsed = Math.max(0, ((s.endedAt ?? (s.running ? Date.now() : s.startedAt ?? Date.now())) - (s.startedAt ?? Date.now())) / 1000);
  const [, tick] = useState(0);
  useEffect(() => { if (!s.running) return; const id = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(id); }, [s.running]);
  const decisions = s.steps.filter((x) => x.kind === "model_call").length;
  const tools = s.steps.filter((x) => x.kind === "tool_call").length;
  const saved = s.steps.filter((x) => classify(x) === "finding").length;
  const orchSteps = s.steps.filter((x) => x.agent === "orchestrator");
  const latestOrch = [...orchSteps].reverse().find((x) => x.tool !== "delegate_investigation") ?? orchSteps[orchSteps.length - 1];
  const orchLane = s.lanes.find((l) => l.agent === "orchestrator");
  const orchTools = [...new Set(orchSteps.filter((x) => x.kind === "tool_call" && x.tool).map((x) => x.tool as string))];
  const software = s.mode === "software_only";

  return (
    <div className="on-dark overflow-hidden rounded-panel bg-midnight text-night ring-1 ring-midnight-line" aria-live="polite">
      {/* Header + stage track */}
      <div className="flex flex-col gap-4 border-b border-midnight-line px-6 py-4 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3">
          <span className={cn("grid size-7 place-items-center rounded-full", s.running ? "bg-lime/15 text-lime" : s.error ? "bg-red/15 text-red" : "bg-teal/15 text-teal")}>
            {s.running ? <span className="size-2 rounded-full bg-lime animate-ring" /> : s.error ? <X className="size-3.5" /> : <Check className="size-3.5" />}
          </span>
          <div className="leading-tight">
            <div className="text-[14px] font-medium text-white">{software ? (s.running ? "Software checks running (no AI investigation)" : s.error ? "Intelligence scan stopped" : "Intelligence scan complete · software checks only") : s.running ? "Live investigation" : s.error ? "Intelligence scan stopped" : "Intelligence scan complete"}</div>
            <div className="mt-0.5 font-mono text-[11px] text-night-3">{s.model ? `${s.model} · ` : ""}<span className="tnum">{elapsed.toFixed(0)}s</span> · {decisions} AI decisions · {tools} software operations</div>
          </div>
        </div>
        {!software && (
          <ol className="flex flex-1 items-center gap-1 overflow-x-auto lg:justify-end" aria-label="Investigation stages">
            {STAGES.map((st, n) => {
              const on = reached[st.key];
              const current = s.running && n === currentIdx;
              return (
                <li key={st.key} className="flex shrink-0 items-center gap-1">
                  {n > 0 && <span className={cn("h-px w-4 sm:w-6", on ? "bg-lime/60" : "bg-midnight-line")} />}
                  <span className={cn("flex items-center gap-1.5 rounded-full px-2 py-1 text-[11.5px] transition-colors", current ? "bg-lime text-midnight" : on ? "text-night" : "text-night-3")}>
                    <span className={cn("size-1.5 rounded-full", current ? "bg-midnight" : on ? "bg-lime" : "bg-midnight-line")} />
                    {st.label}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {s.verification && (s.verification.resolved.length > 0 || s.verification.updated.length > 0) && (
        <div className="flex gap-3 border-b border-midnight-line bg-teal/[0.08] px-6 py-3 text-[13px] text-night animate-fade-up">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal" />
          <div>
            <span className="font-medium text-white">Software re-verified earlier findings before the agents started.</span>
            <ul className="mt-1 space-y-0.5 text-night-2">
              {s.verification.resolved.map((r) => <li key={r.title}>Resolved · {r.title} — {r.note}</li>)}
              {s.verification.updated.map((r) => <li key={r.title}>Updated · {r.title} — {r.note}</li>)}
            </ul>
          </div>
        </div>
      )}

      {/* Coordinator → lanes */}
      {!software ? (
        <div className="px-4 pb-6 pt-6 sm:px-6">
          <div className="mx-auto flex max-w-2xl items-start gap-4 rounded-xl border border-midnight-line bg-midnight-2 p-4">
            <span className={cn("rounded-[9px]", lanes.orchestrator === "working" && "animate-ring")}><AgentGlyph agent="orchestrator" size={38} onDark /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[14.5px] font-medium text-white">Intelligence Engine</span>
                <LaneWord state={lanes.orchestrator} />
              </div>
              <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-night-2">
                {orchLane?.status === "done" && orchLane.summary ? "Prioritized the findings and wrote the briefing." : latestOrch ? latestOrch.output_summary : "Reviewing the business profile, records and readiness…"}
              </p>
              {orchTools.length > 0 && (
                <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Tools the coordinator used">
                  {orchTools.map((t) => <li key={t} className="rounded-[5px] bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10.5px] text-night-2">{t}</li>)}
                </ul>
              )}
            </div>
          </div>
          {/* connectors */}
          <div className="relative mx-auto hidden h-8 md:block" style={{ maxWidth: "calc(100% - 33.333%)" }} aria-hidden="true">
            <span className="absolute left-1/2 top-0 h-4 w-px -translate-x-1/2 bg-midnight-line" />
            <span className="absolute left-0 right-0 top-4 h-px bg-midnight-line" />
            {[0, 50, 100].map((x, i) => {
              const st = lanes[SPECIALISTS[i]];
              return <span key={x} className={cn("absolute top-4 h-4 w-[2px] -translate-x-1/2", st === "working" ? "connector-flow" : st === "done" ? "bg-lime/60" : st === "failed" ? "bg-red/60" : "bg-midnight-line")} style={{ left: `${x}%` }} />;
            })}
          </div>
          <div className="mt-4 grid gap-3 md:mt-0 md:grid-cols-3">
            {SPECIALISTS.map((a) => <Lane key={a} agent={a} state={lanes[a]} lane={s.lanes.find((l) => l.agent === a)} steps={s.steps.filter((x) => x.agent === a)} compact={compact} />)}
          </div>
        </div>
      ) : (
        <div className="px-6 py-5">
          <ol className="space-y-2">{s.steps.map((st, n) => <ExecCard key={n} step={st} />)}</ol>
        </div>
      )}

      {/* Completion */}
      {s.done && (
        <div className="border-t border-midnight-line bg-midnight-2 px-6 py-6 animate-fade-up">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <dl className="grid grid-cols-3 gap-x-8 gap-y-4 sm:grid-cols-5">
              {[["New findings", s.done.findings_new, true], ["Updated", s.done.findings_updated], ["Resolved", s.done.findings_resolved], ["Drafts prepared", s.done.drafts_prepared, true], ["Tasks created", s.done.tasks_created]].map(([l, v, hi]) => (
                <div key={l as string}>
                  <dt className="text-[12px] text-night-3">{l}</dt>
                  <dd className={cn("tnum mt-1 text-[32px] font-semibold leading-none tracking-[-0.03em]", hi ? "text-lime" : "text-white")}>{v as number}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-2">
              <Button variant="signal" asChild><Link href="/inbox">Review findings <ArrowRight /></Link></Button>
              <Button variant="night" asChild><Link href="/actions">Open work queue</Link></Button>
            </div>
          </div>
          <p className="mt-5 text-[14px] text-night">{s.done.findings_new} new findings, {s.done.findings_updated} updated and {s.done.findings_resolved} resolved · {s.done.drafts_prepared} draft{s.done.drafts_prepared === 1 ? "" : "s"} and {s.done.tasks_created} task{s.done.tasks_created === 1 ? "" : "s"} prepared.</p>
          {saved > 0 && <p className="mt-4 text-[12.5px] text-night-3">Dollar values on findings are calculated by software from your records. Drafts wait for your approval; nothing is sent.</p>}
        </div>
      )}
      {s.error && <div className="flex items-start gap-2.5 border-t border-midnight-line bg-red/10 px-6 py-4 text-[13.5px] text-night"><CircleAlert className="mt-0.5 size-4 shrink-0 text-red" />{s.error}</div>}

      {/* Evidence timeline */}
      {s.steps.length > 0 && (
        <div className="border-t border-midnight-line">
          <button onClick={() => setShowAll((v) => !v)} className="flex w-full items-center gap-2 px-6 py-3 text-left text-[12.5px] text-night-2 hover:text-white">
            <ChevronDown className={cn("size-4 transition-transform", showAll && "rotate-180")} /> {showAll ? "Hide" : "Show"} full evidence timeline ({s.steps.length} steps)
            <span className="ml-auto hidden items-center gap-4 text-[11.5px] text-night-3 sm:flex"><span className="flex items-center gap-1"><Brain className="size-3 text-cobalt" />AI decision</span><span className="flex items-center gap-1"><Cpu className="size-3" />Software analysis</span><span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-lime" />Saved work</span></span>
          </button>
          {showAll && (
            <ol className="max-h-96 space-y-1 overflow-y-auto px-6 pb-5">
              {s.steps.map((st, n) => (
                <li key={n} className="grid grid-cols-[52px_92px_1fr] gap-3 text-[12.5px] leading-snug animate-fade-in">
                  <span className="tnum font-mono text-night-3">{st.t.toFixed(1)}s</span>
                  <span className="truncate text-night-2">{AGENT_META[st.agent]?.short ?? st.agent}</span>
                  <span className={cn(st.kind === "model_call" ? "text-[#9db8ff]" : st.ok ? "text-night" : "text-amber")}>{st.output_summary}{st.tool && <span className="ml-1.5 font-mono text-[11px] text-night-3">{st.tool}</span>}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

function LaneWord({ state }: { state: LaneState }) {
  const map: Record<LaneState, [string, string]> = {
    idle: ["Ready", "text-night-3"], standby: ["Standing by", "text-night-3"], working: ["Investigating", "text-lime"],
    done: ["Complete", "text-teal"], failed: ["Stopped", "text-red"], skipped: ["Not needed this scan", "text-night-3"],
  };
  const [w, c] = map[state];
  return <span className={cn("flex items-center gap-1.5 text-[11.5px]", c)}>{state === "working" ? <Loader2 className="size-3 animate-spin" /> : state === "done" ? <Check className="size-3" /> : null}{w}</span>;
}

function Lane({ agent, state, lane, steps, compact }: { agent: string; state: LaneState; lane?: AgentLane; steps: ScanStep[]; compact?: boolean }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" }); }, [steps.length]);
  const counts = useMemo(() => ({ findings: steps.filter((x) => classify(x) === "finding").length, prepared: steps.filter((x) => ["draft", "task"].includes(classify(x))).length }), [steps]);
  const dim = state === "skipped" || state === "standby" || state === "idle";
  return (
    <div className={cn("flex min-w-0 flex-col rounded-xl border bg-midnight-2/60 transition-colors duration-300", state === "working" ? "border-lime/30" : "border-midnight-line", dim && "opacity-60")}>
      <div className="flex items-center gap-2.5 border-b border-midnight-line px-4 py-3">
        <AgentGlyph agent={agent} size={26} onDark />
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-medium text-white">{AGENT_META[agent].label}</div>
          <LaneWord state={state} />
        </div>
        {(counts.findings > 0 || counts.prepared > 0) && <span className="tnum text-right font-mono text-[10.5px] leading-tight text-night-3">{counts.findings} saved<br />{counts.prepared} prepared</span>}
      </div>
      {lane?.focus && <p className="line-clamp-3 border-b border-midnight-line px-4 py-2.5 text-[12px] leading-relaxed text-night-2"><span className="text-night-3">Assignment · </span>{lane.focus}</p>}
      <ol ref={ref} className={cn("flex-1 space-y-1.5 overflow-y-auto p-3 [mask-image:linear-gradient(to_bottom,transparent,black_14px)]", compact ? "max-h-56" : "max-h-80")}>
        {steps.length === 0 && <li className="px-1 py-6 text-center text-[12px] text-night-3">{state === "standby" ? "Waiting for the coordinator" : state === "skipped" ? "The coordinator didn't need this specialist" : "—"}</li>}
        {steps.map((st, n) => <ExecCard key={n} step={st} />)}
      </ol>
    </div>
  );
}

function ExecCard({ step }: { step: ScanStep }) {
  const k = classify(step);
  const text = k === "finding" ? step.output_summary.replace(/^(Recorded new|Updated existing) finding: |^(Detected|Re-confirmed): /, "") : step.output_summary;
  const wrote = k === "decision" && /^AI wrote/.test(step.output_summary);
  const label = { decision: wrote ? "Concluded" : "Chose", tool: "Ran", finding: step.output_summary.startsWith("Updated") || step.output_summary.startsWith("Re-confirmed") ? "Finding updated" : "Finding saved", draft: "Draft prepared", task: "Task created", resolved: "Resolved", issue: "Issue" }[k];
  const Icon = { decision: Brain, tool: Cpu, finding: Sparkles, draft: Mail, task: ListChecks, resolved: Check, issue: CircleAlert }[k];
  return (
    <li className={cn("rounded-lg px-2.5 py-2 text-[12.5px] leading-snug animate-fade-up",
      k === "finding" ? "bg-lime/[0.09] ring-1 ring-lime/30" : k === "draft" || k === "task" ? "bg-white/[0.05] ring-1 ring-white/10" : k === "issue" ? "bg-amber/10" : "bg-transparent")}>
      <div className="flex items-start gap-2">
        <Icon className={cn("mt-[2px] size-3.5 shrink-0", k === "decision" ? "text-[#9db8ff]" : k === "finding" ? "text-lime" : k === "issue" ? "text-amber" : k === "tool" ? "text-night-3" : "text-night")} />
        <div className="min-w-0">
          <span className={cn("mr-1.5 text-[10.5px] font-medium uppercase tracking-[0.08em]", k === "finding" ? "text-lime" : "text-night-3")}>{label}</span>
          {k === "decision" ? (wrote ? <span className="text-[#c3d3ff]">Wrote its findings summary</span> : <span className="font-mono text-[11.5px] text-[#c3d3ff]">{text.replace(/^AI chose (to call )?/, "")}</span>) : <span className={cn(k === "tool" ? "text-night-2" : "text-night")}>{text}</span>}
          {step.tool && k === "tool" && <span className="ml-1 font-mono text-[10.5px] text-night-3">{step.tool}</span>}
        </div>
      </div>
    </li>
  );
}

/** Back-compat names used by the importer. */
export const ScanConsole = ScanStage;
