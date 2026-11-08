import Link from "next/link";
import { cn } from "@/lib/utils";

/** Underline tabs rendered as links (server-friendly). */
export function LinkTabs({ items, className }: { items: Array<{ href: string; label: string; count?: number; active: boolean }>; className?: string }) {
  return (
    <nav className={cn("flex gap-6 overflow-x-auto border-b border-line", className)} role="tablist">
      {items.map((t) => (
        <Link key={t.href} href={t.href} role="tab" aria-selected={t.active} className={cn("-mb-px flex shrink-0 items-center gap-2 border-b-2 pb-2.5 pt-1 text-[14px] transition-colors", t.active ? "border-ink font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink")}>
          {t.label}
          {t.count != null && <span className={cn("tnum rounded-[5px] px-1.5 text-[11.5px]", t.active ? "bg-ink text-white" : "bg-ink/[0.06] text-ink-3")}>{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

/** Segmented control rendered as links. */
export function Segmented({ items, className }: { items: Array<{ href: string; label: string; active: boolean }>; className?: string }) {
  return (
    <div className={cn("inline-flex rounded-lg bg-ink/[0.05] p-0.5", className)}>
      {items.map((t) => (
        <Link key={t.href} href={t.href} className={cn("rounded-md px-2.5 py-1 text-[12.5px] transition-colors", t.active ? "bg-surface font-medium text-ink shadow-card" : "text-ink-3 hover:text-ink")}>{t.label}</Link>
      ))}
    </div>
  );
}
