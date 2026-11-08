"use client";
import { useEffect, useState } from "react";
import { AgentGlyph, AGENT_META } from "./status";
import { cn } from "@/lib/utils";

export interface RosterScan { status: string; started_at: string; finished_at: string | null }
export type LaneState = "idle" | "standby" | "working" | "done" | "failed" | "skipped";

/** Live event the scan stage broadcasts from real stream events. */
export interface ScanBroadcast { running: boolean; agents: Record<string, LaneState> }

function ago(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

const ORDER = ["orchestrator", "readiness", "sales", "finance"];
const WORD: Record<LaneState, string> = { idle: "Ready", standby: "Standing by", working: "Investigating", done: "Done", failed: "Stopped", skipped: "Not needed" };

export function AgentRoster({ liveAi, scan }: { liveAi: boolean; scan: RosterScan | null }) {
  const [live, setLive] = useState<ScanBroadcast | null>(null);
  useEffect(() => {
    const h = (e: Event) => setLive((e as CustomEvent<ScanBroadcast>).detail);
    window.addEventListener("sirrom:scan", h);
    return () => window.removeEventListener("sirrom:scan", h);
  }, []);
  const running = live?.running ?? scan?.status === "running";
  return (
    <div className="px-3">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-night-3">Agents</span>
        <span className={cn("flex items-center gap-1.5 text-[11.5px]", running ? "text-lime" : liveAi ? "text-night-2" : "text-night-3")}>
          <span className={cn("size-1.5 rounded-full", running ? "bg-lime animate-ring" : liveAi ? "bg-teal" : "bg-night-3")} />
          {running ? "Scan in progress" : liveAi ? (scan?.finished_at ? `Last scan ${ago(scan.finished_at)}` : "Ready to scan") : "AI unavailable"}
        </span>
      </div>
      <ul className="grid grid-cols-2 gap-1.5">
        {ORDER.map((a) => {
          const st: LaneState = live?.agents[a] ?? (liveAi ? "idle" : "skipped");
          return (
            <li key={a} className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors", st === "working" ? "bg-white/[0.07]" : "bg-white/[0.025]")}>
              <AgentGlyph agent={a} size={18} onDark />
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-[12px] text-night">{AGENT_META[a].short}</span>
                <span className={cn("block truncate text-[10.5px]", st === "working" ? "text-lime" : st === "failed" ? "text-red" : "text-night-3")}>{liveAi ? WORD[st] : "Offline"}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
