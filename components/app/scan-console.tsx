"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Play, RefreshCcw, Loader2, CheckCircle2, XCircle, Brain, Cpu, ArrowRight, AlertTriangle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AGENT_META } from "./status";
import { cn } from "@/lib/utils";

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
}

const EMPTY: ScanState = { running: false, steps: [], lanes: [] };

/** Reads an NDJSON scan stream (from the scan endpoint or the import endpoint) into UI state. */
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
          const lanes = s.lanes.filter((l) => l.agent !== ev.agent);
          const prev = s.lanes.find((l) => l.agent === ev.agent);
          return { ...s, lanes: [...lanes, { agent: ev.agent, status: ev.phase === "start" ? "running" : ev.phase, focus: ev.focus ?? prev?.focus, summary: ev.summary }].sort((a, b) => order(a.agent) - order(b.agent)) };
        });
        else if (ev.type === "step") setState((s) => ({ ...s, steps: [...s.steps, { agent: ev.agent, kind: ev.step.kind, tool: ev.step.tool, output_summary: ev.step.output_summary, ok: ev.step.ok, t }] }));
        else if (ev.type === "done") setState((s) => ({ ...s, running: false, done: ev.scan }));
        else if (ev.type === "error") setState((s) => ({ ...s, running: false, error: ev.error }));
        else onOther?.(ev);
      }
    }
    setState((s) => (s.running ? { ...s, running: false, error: sawScan ? s.error ?? "The connection closed before the scan finished. It will show as interrupted." : s.error } : s));
  }, []);
  const start = useCallback(async (opts: { followUp?: boolean; softwareOnly?: boolean } = {}) => {
    const res = await fetch("/api/intelligence/scan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ followUp: opts.followUp, mode: opts.softwareOnly ? "software_only" : undefined }) });
    await consume(res);
  }, [consume]);
  return { state, start, consume, reset: () => setState(EMPTY) };
}

function order(agent: string) {
  return ["orchestrator", "readiness", "sales", "finance", "software"].indexOf(agent);
}

/** Primary scan control + live console. Auto-starts when the URL has ?scan=run or ?scan=followup. */
export function ScanPanel({ liveAi, hasPriorScan }: { liveAi: boolean; hasPriorScan: boolean }) {
  const { state, start } = useScanStream();
  const params = useSearchParams();
  const router = useRouter();
  const auto = useRef(false);

  useEffect(() => {
    const p = params.get("scan");
    if (!p || auto.current || !liveAi) return;
    auto.current = true;
    router.replace("/overview", { scroll: false });
    start({ followUp: p === "followup" }).then(() => router.refresh());
  }, [params, liveAi, start, router]);

  const run = async (o: { followUp?: boolean; softwareOnly?: boolean }) => { await start(o); router.refresh(); };
  const visible = state.running || state.done || state.error;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="lg" onClick={() => run({})} disabled={state.running || !liveAi} className="gap-2">
          {state.running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} {state.running ? "Agents investigating…" : "Run AI Intelligence Scan"}
        </Button>
        {hasPriorScan && liveAi && <Button size="lg" variant="secondary" onClick={() => run({ followUp: true })} disabled={state.running}><RefreshCcw className="size-4" /> Follow-up scan</Button>}
        {!liveAi && <Button size="lg" variant="secondary" onClick={() => run({ softwareOnly: true })} disabled={state.running}><Cpu className="size-4" /> Run software checks only</Button>}
      </div>
      <p className="mt-2 max-w-xl text-[13px] text-ink-3">
        {liveAi ? "Your AI agents will review your business records, investigate important issues, and prepare recommended actions." : "Live AI is unavailable (no OpenAI key on the server), so no AI investigation can run. Software checks are available and clearly labeled."}
      </p>
      {visible && <ScanConsole state={state} />}
    </div>
  );
}

export function ScanConsole({ state }: { state: ScanState }) {
  const lanes = state.lanes.length ? state.lanes : state.running ? [{ agent: state.mode === "software_only" ? "software" : "orchestrator", status: "running" as const }] : [];
  const elapsed = state.steps.length ? state.steps[state.steps.length - 1].t : 0;
  const tools = state.steps.filter((s) => s.kind === "tool_call").length;
  const decisions = state.steps.filter((s) => s.kind === "model_call").length;
  return (
    <div className="mt-5 overflow-hidden rounded-lg border border-line bg-surface shadow-card animate-fade-in">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-subtle/60 px-4 py-2.5 text-xs text-ink-3">
        <span className="flex items-center gap-1.5 font-medium text-ink">
          {state.running ? <Loader2 className="size-3.5 animate-spin text-cobalt" /> : state.error ? <XCircle className="size-3.5 text-red" /> : <CheckCircle2 className="size-3.5 text-teal" />}
          {state.mode === "software_only" ? "Software checks (no AI)" : "Intelligence scan"} {state.running ? "in progress" : state.error ? "stopped" : "complete"}
        </span>
        {state.model && <span className="font-mono text-[11px]">live model {state.model}</span>}
        <span className="flex items-center gap-1"><Brain className="size-3" /> {decisions} AI decisions</span>
        <span className="flex items-center gap-1"><Cpu className="size-3" /> {tools} software operations</span>
        <span className="tnum ml-auto">{elapsed.toFixed(0)}s</span>
      </div>

      {state.verification && (state.verification.resolved.length > 0 || state.verification.updated.length > 0) && (
        <div className="border-b border-line px-4 py-2.5 text-xs text-ink-2">
          <span className="flex items-center gap-1.5 font-medium text-teal-700"><ShieldCheck className="size-3.5" /> Software re-verified earlier findings first</span>
          <ul className="mt-1 space-y-0.5">
            {state.verification.resolved.map((r) => <li key={r.title}>Resolved: {r.title} — {r.note}</li>)}
            {state.verification.updated.map((r) => <li key={r.title}>Updated: {r.title} — {r.note}</li>)}
          </ul>
        </div>
      )}

      <div className="grid gap-px bg-line md:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(0,1fr))]">
        {lanes.map((l) => {
          const m = AGENT_META[l.agent] ?? AGENT_META.advisor;
          const steps = state.steps.filter((s) => s.agent === l.agent);
          return (
            <div key={l.agent} className="min-w-0 bg-surface p-3.5">
              <div className="mb-2 flex items-center gap-2">
                <span className={cn("size-2 rounded-[2px]", m.color)} />
                <span className="text-[13px] font-medium">{m.label}</span>
                <span className="ml-auto text-[11px] text-ink-3">{l.status === "running" ? <span className="flex items-center gap-1"><Loader2 className="size-3 animate-spin" />working</span> : l.status === "failed" ? "failed" : "done"}</span>
              </div>
              {l.focus && <p className="mb-2 line-clamp-3 rounded bg-subtle px-2 py-1.5 text-[11.5px] leading-snug text-ink-2"><span className="font-medium">Assignment: </span>{l.focus}</p>}
              <ol className="max-h-72 space-y-1 overflow-y-auto pr-1">
                {steps.map((s, n) => (
                  <li key={n} className="flex gap-2 text-[12px] leading-snug animate-fade-in">
                    {s.kind === "model_call" ? <Brain className="mt-[2px] size-3 shrink-0 text-cobalt" /> : s.ok ? <Cpu className="mt-[2px] size-3 shrink-0 text-ink-4" /> : <AlertTriangle className="mt-[2px] size-3 shrink-0 text-amber" />}
                    <span className={cn(s.kind === "model_call" ? "text-cobalt-700" : s.ok ? "text-ink-2" : "text-amber-700")}>
                      {s.output_summary}
                      {s.tool && <span className="ml-1 font-mono text-[10.5px] text-ink-4">{s.tool}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>

      {state.done && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line bg-subtle/40 px-4 py-3 text-[13px]">
          <span><b className="tnum">{state.done.findings_new}</b> new findings</span>
          <span><b className="tnum">{state.done.findings_updated}</b> updated</span>
          <span><b className="tnum">{state.done.findings_resolved}</b> resolved</span>
          <span><b className="tnum">{state.done.drafts_prepared}</b> drafts prepared</span>
          <span><b className="tnum">{state.done.tasks_created}</b> tasks created</span>
          <span className="ml-auto flex gap-2">
            <Link href="/inbox" className="inline-flex items-center gap-1 font-medium text-cobalt hover:underline">Review findings <ArrowRight className="size-3.5" /></Link>
            <Link href="/actions" className="inline-flex items-center gap-1 font-medium text-cobalt hover:underline">Prepared work <ArrowRight className="size-3.5" /></Link>
          </span>
        </div>
      )}
      {state.error && <div className="border-t border-line bg-red-50 px-4 py-3 text-[13px] text-red-700">{state.error}</div>}
      <div className="border-t border-line px-4 py-2 text-[11px] text-ink-4">
        <Brain className="mr-1 inline size-3 text-cobalt" />AI investigation: the model decided what to do next. <Cpu className="ml-3 mr-1 inline size-3" />Software analysis: deterministic tools ran on your records. Summaries only; no hidden reasoning is shown.
      </div>
    </div>
  );
}
