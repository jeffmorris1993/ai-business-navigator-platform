"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Inbox, Gauge, TrendingUp, Wallet, ListChecks, Database, MessageSquareText, Building2, Activity, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const NAV_GROUPS = [
  {
    label: "Workspace",
    items: [
      { href: "/overview", label: "Overview", Icon: LayoutGrid },
      { href: "/inbox", label: "Intelligence Inbox", Icon: Inbox, countKey: "findings" as const },
      { href: "/readiness", label: "AI Readiness", Icon: Gauge },
      { href: "/sales", label: "Sales Intelligence", Icon: TrendingUp },
      { href: "/finance", label: "Financial Intelligence", Icon: Wallet },
      { href: "/actions", label: "Action Center", Icon: ListChecks, countKey: "actions" as const },
    ],
  },
  {
    label: "Data & AI",
    items: [
      { href: "/activity", label: "Agent Activity", Icon: Activity },
      { href: "/data", label: "Data & Connections", Icon: Database },
      { href: "/advisor", label: "AI Advisor", Icon: MessageSquareText },
    ],
  },
  { label: "Program", items: [{ href: "/sponsor-access", label: "Sponsor Dashboard", Icon: Building2 }] },
];

export function Logo() {
  return (
    <Link href="/overview" className="flex items-center gap-2.5">
      <span className="relative grid size-7 place-items-center rounded-md bg-ink text-[13px] font-semibold text-white">
        S<span className="absolute -right-0.5 -top-0.5 size-2 rounded-full border-2 border-[#fbfbfa] bg-cobalt" />
      </span>
      <span className="leading-tight">
        <span className="block text-[13.5px] font-semibold tracking-tight text-ink">Sirrom</span>
        <span className="block text-[11px] text-ink-3">Business AI Navigator</span>
      </span>
    </Link>
  );
}

function NavList({ counts, onNavigate }: { counts: { findings: number; actions: number }; onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-5">
      {NAV_GROUPS.map((g) => (
        <div key={g.label}>
          <div className="mb-1 px-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-4">{g.label}</div>
          <div className="flex flex-col gap-px">
            {g.items.map(({ href, label, Icon, ...rest }) => {
              const active = path === href || path.startsWith(href + "/");
              const count = "countKey" in rest && rest.countKey ? counts[rest.countKey] : 0;
              return (
                <Link key={href} href={href} onClick={onNavigate} className={cn("relative flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] transition-colors", active ? "bg-surface font-medium text-ink shadow-card ring-1 ring-line" : "text-ink-2 hover:bg-subtle hover:text-ink")}>
                  {active && <span className="absolute -left-3 top-1.5 bottom-1.5 w-[2px] rounded-full bg-cobalt" />}
                  <Icon className={cn("size-[15px]", active ? "text-ink" : "text-ink-3")} strokeWidth={1.75} />
                  {label}
                  {count > 0 && <span className="tnum ml-auto rounded bg-subtle px-1.5 text-[11px] font-medium text-ink-2 ring-1 ring-line">{count}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar({ counts, footer }: { counts: { findings: number; actions: number }; footer: React.ReactNode }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-[#fbfbfa] px-3 py-4 lg:flex">
      <div className="mb-6 px-2"><Logo /></div>
      <NavList counts={counts} />
      <div className="mt-auto">{footer}</div>
    </aside>
  );
}

export function MobileNav({ counts }: { counts: { findings: number; actions: number } }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const path = usePathname();
  useEffect(() => setMounted(true), []);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open]);
  // Rendered into <body> so no ancestor (sticky header, transforms, filters) can clip the full-screen sheet.
  const sheet = open && mounted ? createPortal(
    <div className="fixed inset-0 z-[60] bg-ink/30 lg:hidden" onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label="Navigation">
      <div className="h-full w-72 max-w-[85vw] overflow-y-auto bg-[#fbfbfa] px-3 py-4 shadow-pop animate-slide-in" onClick={(e) => e.stopPropagation()}>
        <div className="mb-6 flex items-center justify-between px-2"><Logo /><button onClick={() => setOpen(false)} aria-label="Close navigation" className="rounded p-1 text-ink-3 hover:bg-subtle"><X className="size-4" /></button></div>
        <NavList counts={counts} onNavigate={() => setOpen(false)} />
      </div>
    </div>,
    document.body,
  ) : null;
  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-md p-1.5 text-ink-2 hover:bg-subtle lg:hidden" aria-label="Open navigation"><Menu className="size-5" /></button>
      {sheet}
    </>
  );
}
