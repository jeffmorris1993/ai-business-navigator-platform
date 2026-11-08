"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageSquareText, X } from "lucide-react";
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
    window.addEventListener("sirrom:ask", h);
    return () => window.removeEventListener("sirrom:ask", h);
  }, []);
  if (path.startsWith("/advisor")) return null;
  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} className="fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-md border border-line-strong bg-surface px-3 py-2 text-[13px] font-medium text-ink shadow-pop hover:bg-subtle">
          <MessageSquareText className="size-4 text-cobalt" /> Ask the Advisor
        </button>
      )}
      {open && (
        <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[26rem] flex-col border-l border-line bg-canvas shadow-pop animate-slide-in">
          <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
            <div>
              <div className="flex items-center gap-2 text-[13px] font-semibold"><MessageSquareText className="size-4 text-cobalt" /> AI Advisor</div>
              <div className="text-xs text-ink-3">Answers from this business&apos;s records using live tools.</div>
            </div>
            <button onClick={() => setOpen(false)} className="rounded p-1 text-ink-4 hover:bg-subtle" aria-label="Close"><X className="size-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <AgentChat key={question?.n ?? "default"} agent="advisor" liveAi={liveAi} compact autoQuestion={question?.q} suggestions={["What should I focus on this week?", "Why is the top finding the most important?", "Which customers owe me money?"]} />
          </div>
        </div>
      )}
    </>
  );
}
