import Link from "next/link";
import { Brain, Cpu, User } from "lucide-react";
import type { ActivityItem } from "@/lib/intelligence/activity";
import { AGENT_META } from "./status";
import { cn } from "@/lib/utils";

const KIND = {
  ai: { label: "AI investigation", Icon: Brain, color: "text-cobalt bg-cobalt-50" },
  software: { label: "Software analysis", Icon: Cpu, color: "text-ink-2 bg-subtle" },
  owner: { label: "Owner action", Icon: User, color: "text-teal-700 bg-teal-50" },
};

export function timeAgo(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function ActivityTimeline({ items, empty = "No activity yet." }: { items: ActivityItem[]; empty?: string }) {
  if (!items.length) return <p className="text-[13px] text-ink-3">{empty}</p>;
  return (
    <ol className="relative space-y-3.5 before:absolute before:bottom-1 before:left-[11px] before:top-1 before:w-px before:bg-line">
      {items.map((it) => {
        const k = KIND[it.kind];
        const body = (
          <div className="min-w-0">
            <div className="text-[13px] leading-snug text-ink">{it.title}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-ink-3">
              <span>{k.label}</span>
              {it.actor !== "owner" && it.actor !== "software" && <span>· {AGENT_META[it.actor]?.label ?? it.actor}</span>}
              {it.detail && <span className="truncate">· {it.detail}</span>}
              <span>· {timeAgo(it.at)}</span>
            </div>
          </div>
        );
        return (
          <li key={it.id} className="relative flex gap-3">
            <span className={cn("relative z-10 grid size-6 shrink-0 place-items-center rounded-md ring-4 ring-surface", k.color)}><k.Icon className="size-3.5" /></span>
            {it.href ? <Link href={it.href} className="min-w-0 hover:underline decoration-line-strong underline-offset-2">{body}</Link> : body}
          </li>
        );
      })}
    </ol>
  );
}
