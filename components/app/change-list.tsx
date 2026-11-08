import { ArrowRight, Sparkles } from "lucide-react";
import { StatusPill } from "./status";
import type { ReadinessStatus } from "@/lib/readiness/rules";

export interface Change { capability: string; label: string; from: ReadinessStatus | null; to: ReadinessStatus; why: string }

export function ChangeList({ changes, title = "What changed in your AI readiness" }: { changes: Change[]; title?: string }) {
  if (!changes.length) return <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Readiness re-checked automatically. No capability changed status.</div>;
  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-brand-900"><Sparkles className="size-4" /> {title}</div>
      <ul className="space-y-2.5">
        {changes.map((c) => (
          <li key={c.capability} className="animate-fade-in">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{c.label}</span>
              {c.from && <StatusPill status={c.from} />}
              {c.from && <ArrowRight className="size-3.5 text-slate-400" />}
              <span className={c.to === "ready" ? "animate-pop" : ""}><StatusPill status={c.to} /></span>
            </div>
            {c.why && <div className="mt-0.5 text-xs text-slate-600">{c.why}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}
