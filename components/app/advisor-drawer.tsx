"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { AgentChat } from "./agent-chat";

export function AdvisorDrawer({ liveAi }: { liveAi: boolean }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  if (path.startsWith("/advisor")) return null;
  return (
    <>
      <button onClick={() => setOpen(true)} className="fixed bottom-5 right-5 z-30 flex items-center gap-2 rounded-full bg-brand-600 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700 hover:shadow-xl">
        <Sparkles className="size-4" /> Ask AI Advisor
      </button>
      {open && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/20" onClick={() => setOpen(false)}>
          <div className="flex h-full w-full max-w-md flex-col bg-[#f6f7fb] shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center gap-2 font-semibold"><Sparkles className="size-4 text-brand-500" /> AI Advisor</div>
              <button onClick={() => setOpen(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Close"><X className="size-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <AgentChat agent="advisor" liveAi={liveAi} compact suggestions={["What should I focus on this week?", "Am I ready to use the Sales Agent?", "What's preventing me from using Financial Intelligence?"]} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
