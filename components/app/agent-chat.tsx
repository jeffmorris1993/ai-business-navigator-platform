"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Send, Wrench, Brain, CheckCircle2, XCircle, Loader2, ShieldCheck, ArrowUpRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Markdown } from "./markdown";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";

export interface Step { step_no: number; kind: "model_call" | "tool_call"; tool?: string; output_summary: string; ok: boolean; duration_ms: number }
interface Pending { id: string; tool: string; summary: string }
interface Turn { question: string; steps: Step[]; answer?: string; error?: string; links: Array<{ href: string; label: string }>; pending: Pending[]; model?: string; running: boolean }

const AGENT_LABEL: Record<string, string> = { readiness: "AI Readiness Agent", sales: "Sales Intelligence Agent", finance: "Financial Intelligence Agent", advisor: "AI Advisor" };

export function AgentChat({ agent, suggestions = [], liveAi, autoQuestion, compact, onDone }: { agent: "readiness" | "sales" | "finance" | "advisor"; suggestions?: string[]; liveAi: boolean; autoQuestion?: string; compact?: boolean; onDone?: () => void }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const router = useRouter();
  const bottom = useRef<HTMLDivElement>(null);
  const autoRan = useRef(false);
  const running = turns.some((t) => t.running);

  useEffect(() => {
    if (turns.length) bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turns]);

  async function ask(question: string) {
    if (!question.trim() || running) return;
    setInput("");
    setTurns((t) => [...t, { question, steps: [], links: [], pending: [], running: true }]);
    const update = (fn: (t: Turn) => Turn) => setTurns((all) => all.map((t, i) => (i === all.length - 1 ? fn(t) : t)));
    try {
      const res = await fetch("/api/agent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ agent, question, conversationId }) });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        update((t) => ({ ...t, running: false, error: j.error ?? "The agent couldn't run." }));
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === "step") update((t) => ({ ...t, steps: [...t.steps, ev.step] }));
          if (ev.type === "done") {
            setConversationId(ev.conversationId);
            update((t) => ({ ...t, running: false, answer: ev.answer, links: ev.links, pending: ev.pending, model: ev.model }));
            router.refresh();
            onDone?.();
          }
          if (ev.type === "error") update((t) => ({ ...t, running: false, error: ev.error }));
        }
      }
      update((t) => (t.running ? { ...t, running: false, error: t.error ?? "The connection closed early." } : t));
    } catch {
      update((t) => ({ ...t, running: false, error: "Network error. Please try again." }));
    }
  }

  useEffect(() => {
    if (autoQuestion && liveAi && !autoRan.current) {
      autoRan.current = true;
      ask(autoQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoQuestion, liveAi]);

  async function decide(p: Pending, approve: boolean) {
    const r = await api<{ status: string; summary?: string }>(`/api/pending/${p.id}`, { approve });
    setTurns((all) => all.map((t) => ({ ...t, pending: t.pending.filter((x) => x.id !== p.id), steps: t.pending.some((x) => x.id === p.id) ? [...t.steps, { step_no: 999, kind: "tool_call", tool: p.tool, output_summary: approve ? `You approved: ${r.summary ?? p.summary}` : `You rejected: ${p.summary}`, ok: true, duration_ms: 0 }] : t.steps })));
    router.refresh();
  }

  if (!liveAi) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <div>
          <div className="font-medium">Live AI is unavailable</div>
          <p className="mt-0.5 text-amber-800">No OpenAI API key is configured on the server, so the {AGENT_LABEL[agent]} can&apos;t run. Everything else on this page is calculated directly from your records and still works. To enable it, set <code>OPENAI_API_KEY</code> in the server environment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {turns.length === 0 && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button key={s} onClick={() => ask(s)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-left text-xs font-medium text-slate-700 shadow-sm transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700">
              {s}
            </button>
          ))}
        </div>
      )}
      {turns.map((t, i) => (
        <div key={i} className="space-y-3 animate-fade-in">
          <div className="ml-auto w-fit max-w-[85%] rounded-lg rounded-br-sm bg-ink px-4 py-2 text-sm text-white">{t.question}</div>
          <div className="rounded-lg rounded-bl-sm border border-line bg-surface p-4 shadow-card">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-500">
              <Sparkles className="size-3.5 text-brand-500" /> {AGENT_LABEL[agent]}
              {t.model && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">live model: {t.model}</span>}
            </div>
            <ActivityList steps={t.steps} running={t.running} compact={compact} />
            {t.answer && <div className="mt-3 border-t border-slate-100 pt-3"><Markdown text={t.answer} /></div>}
            {t.error && <div className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{t.error}</div>}
            {t.pending.map((p) => (
              <div key={p.id} className="mt-3 flex flex-col gap-2 rounded-lg border border-violet-200 bg-violet-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2 text-sm text-violet-900"><ShieldCheck className="mt-0.5 size-4" /> <span><span className="font-medium">Needs your approval:</span> {p.summary}</span></div>
                <div className="flex gap-2">
                  <Button size="sm" variant="success" onClick={() => decide(p, true)}>Approve</Button>
                  <Button size="sm" variant="secondary" onClick={() => decide(p, false)}>Reject</Button>
                </div>
              </div>
            ))}
            {t.links.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {t.links.map((l) => (
                  <Link key={l.href} href={l.href} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-700">
                    {l.label} <ArrowUpRight className="size-3" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
      <div ref={bottom} />
      <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Ask the ${AGENT_LABEL[agent]}...`} disabled={running} className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40" />
        <Button type="submit" disabled={running || !input.trim()} className="h-10">{running ? <Loader2 className="animate-spin" /> : <Send />} Ask</Button>
      </form>
    </div>
  );
}

export function ActivityList({ steps, running, compact }: { steps: Step[]; running?: boolean; compact?: boolean }) {
  const toolSteps = steps.filter((s) => s.kind === "tool_call");
  const visible = compact ? toolSteps : steps;
  if (!visible.length && !running) return null;
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Agent activity {toolSteps.length > 0 && `· ${toolSteps.length} tool action${toolSteps.length === 1 ? "" : "s"}`}</div>
      <ol className="space-y-1.5">
        {visible.map((s, i) => (
          <li key={i} className="flex items-start gap-2 text-xs animate-fade-in">
            {s.kind === "model_call" ? <Brain className="mt-0.5 size-3.5 shrink-0 text-violet-500" /> : s.ok ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" /> : <XCircle className="mt-0.5 size-3.5 shrink-0 text-rose-500" />}
            <span className={cn("text-slate-700", s.kind === "model_call" && "text-slate-500")}>
              {s.output_summary}
              {s.tool && <span className="ml-1.5 inline-flex items-center gap-0.5 font-mono text-[10px] text-slate-400"><Wrench className="size-2.5" />{s.tool}</span>}
            </span>
          </li>
        ))}
        {running && (
          <li className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="size-3.5 animate-spin" /> Working...</li>
        )}
      </ol>
    </div>
  );
}
