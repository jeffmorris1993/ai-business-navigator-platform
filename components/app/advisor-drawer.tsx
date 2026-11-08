"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { AgentGlyph } from "./status";
import { AgentChat } from "./agent-chat";

/** Secondary, contextual assistant. Opens from the corner button or via a "sirrom:ask" event (e.g. Ask about this finding). */
export function AdvisorDrawer({ liveAi }: { liveAi: boolean }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState<{ q: string; n: number } | null>(null);
  const path = usePathname();
  useEffect(() => {
    const h = (e: Event) => {
      setQuestion({ q: String((e as CustomEvent).detail), n: Date.now() });
      setOpen(true);
    };
    const o = () => setOpen(true);
    window.addEventListener("sirrom:ask", h);
    window.addEventListener("sirrom:advisor", o);
    return () => { window.removeEventListener("sirrom:ask", h); window.removeEventListener("sirrom:advisor", o); };
  }, []);
  if (path.startsWith("/advisor")) return null;
  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} className="fixed bottom-5 right-5 z-30 flex items-center gap-2 rounded-full bg-midnight py-2 pl-2 pr-2 sm:pr-4 text-[13.5px] font-medium text-white shadow-pop ring-1 ring-midnight-line transition hover:bg-midnight-2">
          <AgentGlyph agent="advisor" size={24} onDark /><span className="hidden sm:inline">Ask the Advisor</span><span className="sr-only sm:hidden">Ask the Advisor</span>
        </button>
      )}
      {open && (
        <div role="dialog" aria-label="AI Advisor" className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[28rem] flex-col border-l border-line bg-canvas shadow-pop animate-slide-in">
          <div className="on-dark flex items-center justify-between bg-midnight px-5 py-4">
            <div className="flex items-center gap-3">
              <AgentGlyph agent="advisor" size={30} onDark />
              <div>
                <div className="font-display text-[18px] leading-tight text-white">AI Advisor</div>
                <div className="text-[12px] text-night-3">Answers from this business&apos;s records using live tools.</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-md p-1.5 text-night-3 hover:bg-white/10 hover:text-white" aria-label="Close"><X className="size-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <AgentChat key={question?.n ?? "default"} agent="advisor" liveAi={liveAi} compact autoQuestion={question?.q} suggestions={["What should I focus on this week?", "Why is the top finding the most important?", "Which customers owe me money?"]} />
          </div>
        </div>
      )}
    </>
  );
}
