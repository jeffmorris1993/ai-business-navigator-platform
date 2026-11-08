"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Gauge, TrendingUp, Wallet, ListChecks, Database, Sparkles, Building2, Compass } from "lucide-react";
import { cn } from "@/lib/utils";

export const NAV = [
  { href: "/home", label: "Home", Icon: Home },
  { href: "/readiness", label: "My AI Readiness", Icon: Gauge },
  { href: "/sales", label: "Sales Intelligence", Icon: TrendingUp },
  { href: "/finance", label: "Financial Intelligence", Icon: Wallet },
  { href: "/actions", label: "My Action Plan", Icon: ListChecks },
  { href: "/data", label: "Data & Connections", Icon: Database },
  { href: "/advisor", label: "AI Advisor", Icon: Sparkles },
];

export function Sidebar({ openTasks }: { openTasks: number }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map(({ href, label, Icon }) => {
        const active = path === href || path.startsWith(href + "/");
        return (
          <Link key={href} href={href} className={cn("group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors", active ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white")}>
            <Icon className={cn("size-4", active ? "text-sky-300" : "text-slate-400 group-hover:text-slate-200")} />
            {label}
            {href === "/actions" && openTasks > 0 && <span className="ml-auto rounded-full bg-sky-400/20 px-2 text-xs text-sky-200">{openTasks}</span>}
          </Link>
        );
      })}
      <div className="my-3 border-t border-white/10" />
      <Link href="/sponsor-access" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white">
        <Building2 className="size-4 text-slate-400" /> Sponsor Dashboard
      </Link>
      <Link href="/demo" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white">
        <Compass className="size-4 text-slate-400" /> 5-minute demo
      </Link>
    </nav>
  );
}

export function MobileNav() {
  const path = usePathname();
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 lg:hidden">
      {NAV.map(({ href, label }) => (
        <Link key={href} href={href} className={cn("whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium", path.startsWith(href) ? "bg-brand-50 text-brand-700" : "text-slate-600")}>
          {label}
        </Link>
      ))}
    </div>
  );
}
