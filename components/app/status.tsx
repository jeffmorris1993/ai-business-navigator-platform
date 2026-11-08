import { CheckCircle2, CircleDashed, AlertTriangle, CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReadinessStatus } from "@/lib/readiness/rules";

export const STATUS_META: Record<ReadinessStatus, { label: string; className: string; dot: string; Icon: typeof CheckCircle2 }> = {
  ready: { label: "Ready", className: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500", Icon: CheckCircle2 },
  partial: { label: "Partially Ready", className: "bg-amber-50 text-amber-800 ring-amber-200", dot: "bg-amber-500", Icon: CircleDashed },
  needs_setup: { label: "Needs Setup", className: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500", Icon: AlertTriangle },
  not_assessed: { label: "Not Assessed", className: "bg-slate-100 text-slate-600 ring-slate-200", dot: "bg-slate-400", Icon: CircleHelp },
};

export function StatusPill({ status, className }: { status: ReadinessStatus; className?: string }) {
  const m = STATUS_META[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset", m.className, className)}>
      <m.Icon className="size-3.5" />
      {m.label}
    </span>
  );
}

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, tone = "default" }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "default" | "green" | "amber" | "red" | "brand" }) {
  const tones = { default: "text-ink", green: "text-emerald-700", amber: "text-amber-700", red: "text-rose-700", brand: "text-brand-700" };
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={cn("mt-1 text-2xl font-semibold tracking-tight", tones[tone])}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-10 text-center">
      {icon && <div className="mb-3 text-slate-400">{icon}</div>}
      <div className="font-medium text-slate-800">{title}</div>
      {children && <div className="mt-1 max-w-md text-sm text-slate-500">{children}</div>}
    </div>
  );
}
