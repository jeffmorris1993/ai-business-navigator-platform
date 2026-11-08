import { cn } from "@/lib/utils";
import type { ReadinessStatus } from "@/lib/readiness/rules";

export const STATUS_META: Record<ReadinessStatus, { label: string; text: string; dot: string }> = {
  ready: { label: "Ready", text: "text-teal-700", dot: "bg-teal" },
  partial: { label: "Partially ready", text: "text-amber-700", dot: "bg-amber" },
  needs_setup: { label: "Needs setup", text: "text-red-700", dot: "bg-red" },
  not_assessed: { label: "Not assessed", text: "text-ink-3", dot: "bg-ink-4" },
};

/** Status as a dot + label (not a pill). */
export function StatusPill({ status, className }: { status: ReadinessStatus; className?: string }) {
  const m = STATUS_META[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", m.text, className)}>
      <span className={cn("size-1.5 rounded-full", m.dot)} />
      {m.label}
    </span>
  );
}

export const PRIORITY_META: Record<string, { label: string; dot: string; text: string }> = {
  critical: { label: "Critical", dot: "bg-red", text: "text-red-700" },
  high: { label: "High", dot: "bg-amber", text: "text-amber-700" },
  medium: { label: "Medium", dot: "bg-cobalt", text: "text-cobalt-700" },
  low: { label: "Low", dot: "bg-ink-4", text: "text-ink-3" },
};

export function Priority({ p, className }: { p: string; className?: string }) {
  const m = PRIORITY_META[p] ?? PRIORITY_META.low;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", m.text, className)}>
      <span className={cn("size-1.5 rounded-full", m.dot)} />
      {m.label}
    </span>
  );
}

export const AGENT_META: Record<string, { label: string; short: string; color: string }> = {
  orchestrator: { label: "Intelligence Engine", short: "Engine", color: "bg-ink" },
  readiness: { label: "Readiness Agent", short: "Readiness", color: "bg-cobalt" },
  sales: { label: "Sales Agent", short: "Sales", color: "bg-teal" },
  finance: { label: "Financial Agent", short: "Finance", color: "bg-amber" },
  advisor: { label: "AI Advisor", short: "Advisor", color: "bg-ink-3" },
  software: { label: "Software check", short: "Software", color: "bg-ink-4" },
  owner: { label: "You", short: "You", color: "bg-ink-2" },
};

export function AgentTag({ agent, className }: { agent: string; className?: string }) {
  const m = AGENT_META[agent] ?? AGENT_META.advisor;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-ink-2", className)}>
      <span className={cn("size-2 rounded-[2px]", m.color)} />
      {m.short}
    </span>
  );
}

export function PageHeader({ title, description, eyebrow, children }: { title: string; description?: string; eyebrow?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <div className="mb-1 text-xs font-medium text-ink-3">{eyebrow}</div>}
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-ink-3">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, tone = "default", className }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "default" | "green" | "amber" | "red" | "brand"; className?: string }) {
  const tones = { default: "text-ink", green: "text-teal-700", amber: "text-amber-700", red: "text-red-700", brand: "text-cobalt-700" };
  return (
    <div className={cn("rounded-lg border border-line bg-surface px-4 py-3.5 shadow-card", className)}>
      <div className="text-xs text-ink-3">{label}</div>
      <div className={cn("tnum mt-1 text-[22px] font-semibold tracking-tight", tones[tone])}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-3">{sub}</div>}
    </div>
  );
}

/** A row of stats joined into one bordered strip. */
export function StatStrip({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line shadow-card lg:grid-cols-4 [&>*]:rounded-none [&>*]:border-0 [&>*]:shadow-none", className)}>{children}</div>;
}

export function EmptyState({ icon, title, children }: { icon?: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line-strong bg-surface/60 px-6 py-10 text-center">
      {icon && <div className="mb-2 text-ink-4">{icon}</div>}
      <div className="text-sm font-medium text-ink">{title}</div>
      {children && <div className="mt-1 max-w-md text-[13px] text-ink-3">{children}</div>}
    </div>
  );
}
