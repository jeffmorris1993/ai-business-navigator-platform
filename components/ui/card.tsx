import * as React from "react";
import { cn } from "@/lib/utils";

/** Raised panel. Use sparingly: most content sits directly on the canvas, separated by rules. */
export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-line bg-surface shadow-card", className)} {...p} />;
}
export function CardHeader({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5 px-6 pb-4 pt-6", className)} {...p} />;
}
export function CardTitle({ className, ...p }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("font-display text-[21px] leading-tight tracking-[-0.01em] text-ink", className)} {...p} />;
}
export function CardDescription({ className, ...p }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-body-sm text-ink-3", className)} {...p} />;
}
export function CardContent({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-6 pb-6", className)} {...p} />;
}
/** Midnight intelligence panel. */
export function NightPanel({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("on-dark rounded-panel bg-midnight text-night ring-1 ring-midnight-line", className)} {...p} />;
}
/** Section heading: a confident title, optional description and action, separated by a hairline. */
export function SectionHeader({ title, description, action, className, display }: { title: string; description?: string; action?: React.ReactNode; className?: string; display?: boolean }) {
  return (
    <div className={cn("mb-4 flex items-end justify-between gap-4 border-b border-line pb-3", className)}>
      <div className="min-w-0">
        <h2 className={cn(display ? "font-display text-title text-ink" : "text-heading font-semibold tracking-[-0.01em] text-ink")}>{title}</h2>
        {description && <p className="mt-0.5 text-body-sm text-ink-3">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
/** Small mono label used for technical metadata. */
export function Eyebrow({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("font-mono text-[11px] uppercase tracking-[0.14em] text-ink-4", className)} {...p} />;
}
