import Link from "next/link";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { Priority, AgentTag } from "./status";
import { formatMoney } from "@/lib/calc/money";
import { VALUE_LABEL, STATUS_LABEL, categoryDef, type ValueKind } from "@/lib/intelligence/categories";
import type { FindingRow } from "@/lib/intelligence/findings";
import { cn } from "@/lib/utils";

const RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
export function sortFindings(f: FindingRow[]) {
  return [...f].sort((a, b) => RANK[a.priority] - RANK[b.priority] || (b.value ?? 0) - (a.value ?? 0));
}

export function FindingStatus({ status, className }: { status: string; className?: string }) {
  const tone: Record<string, string> = {
    new: "text-cobalt-700 bg-cobalt-50", needs_review: "text-amber-700 bg-amber-50", action_prepared: "text-teal-700 bg-teal-50",
    in_progress: "text-ink-2 bg-subtle", resolved: "text-teal-700 bg-teal-50", dismissed: "text-ink-3 bg-subtle",
  };
  return <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", tone[status] ?? "bg-subtle text-ink-3", className)}>{STATUS_LABEL[status] ?? status}</span>;
}

export function FindingValue({ f, className }: { f: Pick<FindingRow, "value" | "value_kind">; className?: string }) {
  if (f.value == null || f.value_kind === "none") return null;
  return (
    <div className={cn("text-right", className)}>
      <div className="tnum text-[15px] font-semibold tracking-tight">{f.value_kind === "expense_change" ? "+" : ""}{formatMoney(f.value)}{f.value_kind === "expense_change" ? "/mo" : ""}</div>
      <div className="text-[11px] text-ink-3">{VALUE_LABEL[f.value_kind as ValueKind]}</div>
    </div>
  );
}

/** Compact ranked list of findings. */
export function FindingList({ findings, compact, selectedId }: { findings: FindingRow[]; compact?: boolean; selectedId?: string }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface shadow-card">
      {findings.map((f, i) => (
        <li key={f.id}>
          <Link href={`/inbox?f=${f.id}`} className={cn("group flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-subtle/60", selectedId === f.id && "bg-cobalt-50/60")}>
            {!compact && <span className="tnum mt-0.5 w-4 text-xs text-ink-4">{i + 1}</span>}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Priority p={f.priority} />
                <AgentTag agent={f.agent} />
                <span className="text-xs text-ink-4">{categoryDef(f.category)?.label}</span>
                <FindingStatus status={f.status} />
              </div>
              <div className="mt-1 text-[14px] font-medium leading-snug text-ink">{f.title}</div>
              {!compact && <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-3">{f.explanation}</p>}
              {!compact && f.recommended_action && <p className="mt-1.5 text-[12.5px] text-ink-2"><span className="text-ink-4">Recommended → </span>{f.recommended_action}</p>}
              {f.status === "needs_review" && f.resolution_note && <p className="mt-1.5 flex items-center gap-1 text-[12px] text-amber-700"><ShieldCheck className="size-3" />{f.resolution_note}</p>}
            </div>
            <FindingValue f={f} className="shrink-0" />
            <ChevronRight className="mt-1 size-4 shrink-0 text-ink-4 transition group-hover:translate-x-0.5 group-hover:text-ink-2" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
