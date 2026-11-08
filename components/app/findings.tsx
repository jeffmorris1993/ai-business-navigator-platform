import Link from "next/link";
import { ArrowUpRight, ShieldCheck, ArrowRight } from "lucide-react";
import { Priority, AgentGlyph, AGENT_META } from "./status";
import { formatMoney } from "@/lib/calc/money";
import { VALUE_LABEL, STATUS_LABEL, categoryDef, type ValueKind } from "@/lib/intelligence/categories";
import type { FindingRow } from "@/lib/intelligence/findings";
import { cn } from "@/lib/utils";

const RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
export function sortFindings(f: FindingRow[]) {
  return [...f].sort((a, b) => RANK[a.priority] - RANK[b.priority] || (b.value ?? 0) - (a.value ?? 0));
}

/** Status as quiet text with a small dot. */
export function FindingStatus({ status, className }: { status: string; className?: string }) {
  const dot: Record<string, string> = { new: "bg-cobalt", needs_review: "bg-amber", action_prepared: "bg-teal", in_progress: "bg-ink-3", resolved: "bg-teal", dismissed: "bg-ink-4" };
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[12px] text-ink-3", className)}>
      <span className={cn("size-1.5 rounded-full", dot[status] ?? "bg-ink-4")} />{STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function formatFindingValue(f: Pick<FindingRow, "value" | "value_kind">) {
  if (f.value == null || f.value_kind === "none") return null;
  return `${f.value_kind === "expense_change" ? "+" : ""}${formatMoney(f.value)}${f.value_kind === "expense_change" ? "/mo" : ""}`;
}

export function FindingValue({ f, className, size = "md" }: { f: Pick<FindingRow, "value" | "value_kind">; className?: string; size?: "md" | "lg" }) {
  const v = formatFindingValue(f);
  if (!v) return null;
  return (
    <div className={cn("text-right", className)}>
      <div className={cn("tnum font-semibold tracking-[-0.02em] text-ink", size === "lg" ? "text-[30px] leading-none" : "text-[15.5px]")}>{v}</div>
      <div className="mt-1 text-[11.5px] text-ink-3">{VALUE_LABEL[f.value_kind as ValueKind]}</div>
    </div>
  );
}

/** The single most important finding, presented as an editorial lead. */
export function FeaturedFinding({ f }: { f: FindingRow }) {
  const v = formatFindingValue(f);
  return (
    <article className="relative overflow-hidden rounded-panel border border-line bg-surface shadow-card">
      <span className={cn("absolute inset-y-0 left-0 w-[3px]", f.priority === "critical" ? "bg-red" : f.priority === "high" ? "bg-amber" : "bg-cobalt")} />
      <div className="grid gap-6 p-6 sm:p-7 md:grid-cols-[minmax(0,1fr)_200px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-4">Top finding</span>
            <Priority p={f.priority} />
            <span className="flex items-center gap-1.5 text-[12.5px] text-ink-3"><AgentGlyph agent={f.agent} size={16} />{AGENT_META[f.agent]?.label ?? f.agent}</span>
          </div>
          <h3 className="mt-3 font-display text-[25px] leading-[1.18] tracking-[-0.01em] text-ink">{f.title}</h3>
          <p className="mt-3 line-clamp-3 text-[14.5px] leading-relaxed text-ink-2">{f.explanation}</p>
          {f.recommended_action && (
            <div className="mt-5 flex gap-3 rounded-lg bg-subtle/70 px-4 py-3">
              <ArrowRight className="mt-0.5 size-4 shrink-0 text-cobalt" />
              <p className="text-[14px] leading-relaxed text-ink"><span className="text-ink-3">What to do next · </span>{f.recommended_action}</p>
            </div>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={`/inbox?f=${f.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-ink px-3.5 text-[13.5px] font-medium text-white hover:bg-ink/85">Open case <ArrowUpRight className="size-4" /></Link>
            <Link href="/inbox" className="inline-flex h-9 items-center rounded-[8px] px-3 text-[13.5px] font-medium text-ink-2 hover:bg-ink/5">All findings</Link>
          </div>
        </div>
        {v && (
          <div className="flex flex-col justify-between border-t border-line pt-5 md:border-l md:border-t-0 md:pl-6 md:pt-0">
            <div>
              <div className="text-[12px] text-ink-3">{VALUE_LABEL[f.value_kind as ValueKind]}</div>
              <div className="tnum mt-1.5 text-[38px] font-semibold leading-none tracking-[-0.035em] text-ink">{v}</div>
            </div>
            <div className="mt-4 flex items-start gap-1.5 text-[12px] leading-snug text-teal-700"><ShieldCheck className="mt-px size-3.5 shrink-0" />Calculated by software from {f.record_refs?.length ?? 0} record{(f.record_refs?.length ?? 0) === 1 ? "" : "s"}</div>
          </div>
        )}
      </div>
    </article>
  );
}

/** Ranked list of findings as dense editorial rows. */
export function FindingList({ findings, compact, selectedId, start = 0 }: { findings: FindingRow[]; compact?: boolean; selectedId?: string; start?: number }) {
  return (
    <ul className="divide-y divide-line border-y border-line">
      {findings.map((f, i) => (
        <li key={f.id}>
          <Link href={`/inbox?f=${f.id}`} className={cn("group grid grid-cols-[22px_minmax(0,1fr)_auto] items-start gap-x-3 py-4 transition-colors hover:bg-ink/[0.02] sm:gap-x-4", selectedId === f.id && "bg-cobalt-50/60")}>
            <span className="tnum pt-0.5 font-mono text-[12px] text-ink-4">{String(start + i + 1).padStart(2, "0")}</span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Priority p={f.priority} />
                <span className="flex items-center gap-1.5 text-[12px] text-ink-3"><AgentGlyph agent={f.agent} size={14} />{AGENT_META[f.agent]?.short ?? f.agent}</span>
                <span className="hidden text-[12px] text-ink-4 sm:inline">{categoryDef(f.category)?.label}</span>
                <FindingStatus status={f.status} />
              </div>
              <div className="mt-1.5 text-[15px] font-medium leading-snug text-ink group-hover:text-cobalt-700">{f.title}</div>
              {!compact && <p className="mt-1 line-clamp-2 text-[13.5px] leading-relaxed text-ink-3">{f.explanation}</p>}
              {!compact && f.recommended_action && <p className="mt-1.5 line-clamp-1 text-[13px] text-ink-2"><span className="text-ink-4">Recommended → </span>{f.recommended_action}</p>}
              {f.status === "needs_review" && f.resolution_note && <p className="mt-1.5 flex items-center gap-1 text-[12.5px] text-amber-700"><ShieldCheck className="size-3.5" />{f.resolution_note}</p>}
            </div>
            <FindingValue f={f} className="shrink-0 pl-2" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
