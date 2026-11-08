"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Inbox, Gauge, TrendingUp, Wallet, ListChecks, Database, MessageSquareText, Building2, Activity, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/brand/mark";
import { AgentRoster, type RosterScan } from "./agent-roster";
import { RailBusinessSwitcher, type SwitcherBusiness } from "./switch-business";

export const NAV_GROUPS = [
  {
    label: "Intelligence",
    items: [
      { href: "/overview", label: "Overview", Icon: LayoutGrid },
      { href: "/inbox", label: "Intelligence Inbox", Icon: Inbox, countKey: "findings" as const },
      { href: "/activity", label: "Agent Activity", Icon: Activity },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/sales", label: "Sales Intelligence", Icon: TrendingUp },
      { href: "/finance", label: "Financial Intelligence", Icon: Wallet },
      { href: "/actions", label: "Action Center", Icon: ListChecks, countKey: "actions" as const },
    ],
  },
  {
    label: "Setup",
    items: [
      { href: "/readiness", label: "AI Readiness", Icon: Gauge },
      { href: "/data", label: "Data & Connections", Icon: Database },
      { href: "/advisor", label: "AI Advisor", Icon: MessageSquareText },
    ],
  },
  { label: "Program", items: [{ href: "/sponsor-access", label: "Sponsor Dashboard", Icon: Building2 }] },
];

export const PAGE_TITLES: Record<string, string> = Object.fromEntries(NAV_GROUPS.flatMap((g) => g.items.map((i) => [i.href, i.label])));

export function Logo({ tone = "light" }: { tone?: "light" | "dark" }) {
  return <Link href="/overview" aria-label="Sirrom home"><Wordmark tone={tone} size="sm" /></Link>;
}

export interface RailProps {
  counts: { findings: number; actions: number };
  business: SwitcherBusiness;
  businesses: SwitcherBusiness[];
  isSample: boolean;
  liveAi: boolean;
  scan: RosterScan | null;
}

function NavList({ counts, onNavigate }: { counts: RailProps["counts"]; onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-6" aria-label="Main">
      {NAV_GROUPS.map((g) => (
        <div key={g.label}>
          <div className="mb-1.5 px-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-night-3">{g.label}</div>
          <ul className="flex flex-col">
            {g.items.map(({ href, label, Icon, ...rest }) => {
              const active = path === href || path.startsWith(href + "/");
              const count = "countKey" in rest && rest.countKey ? counts[rest.countKey] : 0;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-md px-3 py-[7px] text-[13.5px] transition-colors duration-150",
                      active ? "bg-white/[0.06] font-medium text-white" : "text-night-2 hover:bg-white/[0.035] hover:text-night",
                    )}
                  >
                    <span className={cn("absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full transition-all duration-200", active ? "bg-lime opacity-100" : "opacity-0")} />
                    <Icon className={cn("size-[17px] transition-colors", active ? "text-lime" : "text-night-3 group-hover:text-night-2")} strokeWidth={1.7} />
                    <span className="truncate">{label}</span>
                    {count > 0 && <span className={cn("tnum ml-auto text-[12px]", active ? "text-white" : "text-night-3")}>{count}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function RailBody(p: RailProps & { onNavigate?: () => void; mobile?: boolean }) {
  return (
    <>
      <div className="px-3 pb-5 pt-1"><Logo /></div>
      <div className="mb-6"><RailBusinessSwitcher current={p.business} businesses={p.businesses} isSample={p.isSample} /></div>
      <div className={p.mobile ? "pb-6" : "min-h-0 flex-1 overflow-y-auto pb-6"}><NavList counts={p.counts} onNavigate={p.onNavigate} /></div>
      <div className="border-t border-midnight-line pt-4"><AgentRoster liveAi={p.liveAi} scan={p.scan} /></div>
    </>
  );
}

export function Sidebar(p: RailProps) {
  return (
    <aside className="on-dark fixed inset-y-0 left-0 z-30 hidden w-[256px] flex-col bg-midnight px-3 py-5 lg:flex">
      <RailBody {...p} />
    </aside>
  );
}

export function MobileNav(p: RailProps) {
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
  const sheet = open && mounted ? createPortal(
    <div className="fixed inset-0 z-[60] bg-midnight/50 lg:hidden" onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label="Navigation">
      <div className="on-dark relative flex h-full w-[280px] max-w-[85vw] flex-col overflow-y-auto overscroll-contain bg-midnight px-3 py-5 shadow-pop animate-slide-in" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => setOpen(false)} aria-label="Close navigation" className="absolute right-3 top-4 rounded p-1.5 text-night-2 hover:bg-white/5"><X className="size-4" /></button>
        <RailBody {...p} mobile onNavigate={() => setOpen(false)} />
      </div>
    </div>,
    document.body,
  ) : null;
  return (
    <>
      <button onClick={() => setOpen(true)} className="-ml-1 rounded-md p-1.5 text-ink-2 hover:bg-ink/5 lg:hidden" aria-label="Open navigation"><Menu className="size-5" /></button>
      {sheet}
    </>
  );
}
