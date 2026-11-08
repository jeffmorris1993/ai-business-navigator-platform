import { cn } from "@/lib/utils";
import type { ReadinessStatus } from "@/lib/readiness/rules";

/* ---------------- Readiness status (quiet dot + word) ---------------- */
export const STATUS_META: Record<ReadinessStatus, { label: string; text: string; dot: string }> = {
  ready: { label: "Ready", text: "text-teal-700", dot: "bg-teal" },
  partial: { label: "Partially ready", text: "text-amber-700", dot: "bg-amber" },
  needs_setup: { label: "Needs setup", text: "text-red-700", dot: "bg-red" },
  not_assessed: { label: "Not assessed", text: "text-ink-3", dot: "bg-ink-4" },
};

export function StatusPill({ status, className }: { status: ReadinessStatus; className?: string }) {
  const m = STATUS_META[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[12.5px] font-medium", m.text, className)}>
      <span className={cn("size-1.5 rounded-full", m.dot)} />
      {m.label}
    </span>
  );
}

/* ---------------- Priority (vertical marker + word) ---------------- */
export const PRIORITY_META: Record<string, { label: string; bar: string; text: string; dot: string }> = {
  critical: { label: "Critical", bar: "bg-red", text: "text-red-700", dot: "bg-red" },
  high: { label: "High", bar: "bg-amber", text: "text-amber-700", dot: "bg-amber" },
  medium: { label: "Medium", bar: "bg-cobalt", text: "text-cobalt-700", dot: "bg-cobalt" },
  low: { label: "Low", bar: "bg-ink-4", text: "text-ink-3", dot: "bg-ink-4" },
};

export function Priority({ p, className }: { p: string; className?: string }) {
  const m = PRIORITY_META[p] ?? PRIORITY_META.low;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.06em]", m.text, className)}>
      <span className={cn("h-3 w-[3px] rounded-full", m.bar)} />
      {m.label}
    </span>
  );
}

/* ---------------- Agents ---------------- */
export const AGENT_META: Record<string, { label: string; short: string; color: string; tint: string; text: string }> = {
  orchestrator: { label: "Intelligence Engine", short: "Engine", color: "bg-lime", tint: "bg-midnight", text: "text-lime" },
  readiness: { label: "Readiness Agent", short: "Readiness", color: "bg-cobalt", tint: "bg-cobalt-50", text: "text-cobalt" },
  sales: { label: "Sales Agent", short: "Sales", color: "bg-teal", tint: "bg-teal-50", text: "text-teal" },
  finance: { label: "Financial Agent", short: "Finance", color: "bg-amber", tint: "bg-amber-50", text: "text-amber" },
  advisor: { label: "AI Advisor", short: "Advisor", color: "bg-ink-3", tint: "bg-ink/[0.06]", text: "text-ink-2" },
  software: { label: "Software check", short: "Software", color: "bg-ink-4", tint: "bg-ink/[0.06]", text: "text-ink-3" },
  owner: { label: "You", short: "You", color: "bg-ink-2", tint: "bg-ink/[0.06]", text: "text-ink-2" },
};

/** Distinct geometric glyph per agent. */
export function AgentGlyph({ agent, size = 22, className, onDark }: { agent: string; size?: number; className?: string; onDark?: boolean }) {
  const m = AGENT_META[agent] ?? AGENT_META.advisor;
  const s = size;
  const stroke = "currentColor";
  const inner = (() => {
    switch (agent) {
      case "orchestrator":
        return (<><circle cx="12" cy="12" r="6.5" stroke={stroke} strokeWidth="1.8" /><circle cx="12" cy="12" r="2.4" fill={stroke} /></>);
      case "readiness":
        return (<><rect x="6" y="6" width="12" height="12" rx="2.5" stroke={stroke} strokeWidth="1.8" /><path d="M9 13.5l2 2 4-5" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></>);
      case "sales":
        return (<><path d="M6 16.5l4.5-4.5 3 3L18 9.5" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M14.5 9.5H18V13" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></>);
      case "finance":
        return (<><path d="M7 17V12M12 17V7M17 17v-7" stroke={stroke} strokeWidth="2" strokeLinecap="round" /></>);
      case "owner":
        return (<><circle cx="12" cy="9.5" r="3" stroke={stroke} strokeWidth="1.8" /><path d="M6.5 18c.8-2.6 2.9-4 5.5-4s4.7 1.4 5.5 4" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" /></>);
      default:
        return (<><rect x="7" y="7" width="10" height="10" rx="2" stroke={stroke} strokeWidth="1.8" /><path d="M10 4.5v2.5M14 4.5v2.5M10 17v2.5M14 17v2.5M4.5 10h2.5M4.5 14h2.5M17 10h2.5M17 14h2.5" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" /></>);
    }
  })();
  const box = onDark ? "bg-midnight-3" : m.tint;
  const color = agent === "orchestrator" ? "text-lime" : onDark ? "text-night" : m.text;
  return (
    <span className={cn("inline-grid shrink-0 place-items-center rounded-[6px]", box, color, className)} style={{ width: s, height: s }} aria-hidden="true">
      <svg width={s * 0.78} height={s * 0.78} viewBox="0 0 24 24" fill="none">{inner}</svg>
    </span>
  );
}

export function AgentTag({ agent, className, size = 18 }: { agent: string; className?: string; size?: number }) {
  const m = AGENT_META[agent] ?? AGENT_META.advisor;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[12.5px] text-ink-2", className)}>
      <AgentGlyph agent={agent} size={size} />
      {m.short}
    </span>
  );
}

/* ---------------- Page structure ---------------- */
export function PageHeader({ title, description, eyebrow, children }: { title: string; description?: string; eyebrow?: string; children?: React.ReactNode }) {
  return (
    <header className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        {eyebrow && <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-4">{eyebrow}</div>}
        <h1 className="font-display text-display text-ink">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-body text-ink-3">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

/* ---------------- Metrics (open layout, no cards) ---------------- */
export function Stat({ label, value, sub, tone = "default", className }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "default" | "green" | "amber" | "red" | "brand"; className?: string }) {
  const tones = { default: "text-ink", green: "text-teal-700", amber: "text-amber-700", red: "text-red-700", brand: "text-cobalt-700" };
  return (
    <div className={cn("min-w-0 py-1", className)}>
      <div className="text-[12.5px] font-medium text-ink-3">{label}</div>
      <div className={cn("tnum mt-2 text-metric font-semibold tracking-[-0.03em]", tones[tone])}>{value}</div>
      {sub && <div className="mt-2 text-[13px] text-ink-3">{sub}</div>}
    </div>
  );
}

/** A band of metrics separated by vertical rules. */
export function StatStrip({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-y-6 border-y border-line py-6 lg:grid-cols-4 lg:divide-x lg:divide-line [&>*]:px-0 lg:[&>*]:px-6 lg:[&>*:first-child]:pl-0", className)}>{children}</div>;
}
export const MetricBand = StatStrip;

export function EmptyState({ icon, title, children }: { icon?: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line-strong px-6 py-12 text-center">
      {icon && <div className="mb-3 text-ink-4">{icon}</div>}
      <div className="font-display text-heading text-ink">{title}</div>
      {children && <div className="mt-1.5 max-w-md text-body-sm text-ink-3">{children}</div>}
    </div>
  );
}
