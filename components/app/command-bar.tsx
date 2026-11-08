"use client";
import { usePathname } from "next/navigation";
import { MessageSquareText } from "lucide-react";
import { PAGE_TITLES, MobileNav, type RailProps } from "./sidebar";
import { DemoModeButton } from "./demo-mode";
import { cn } from "@/lib/utils";

export function CommandBar({ rail, businessName, slug, model }: { rail: RailProps; businessName: string; slug: string | null; model: string }) {
  const path = usePathname();
  const key = Object.keys(PAGE_TITLES).find((k) => path === k || path.startsWith(k + "/"));
  const title = key ? PAGE_TITLES[key] : "Workspace";
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-canvas px-4 sm:px-8">
      <MobileNav {...rail} />
      <div className="flex min-w-0 items-baseline gap-2 text-[13.5px]">
        <span className="hidden truncate text-ink-3 sm:inline">{businessName}</span>
        <span className="hidden text-ink-4 sm:inline">/</span>
        <span className="truncate font-medium text-ink">{title}</span>
      </div>
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <span className={cn("hidden items-center gap-2 rounded-md px-2 py-1 text-[12.5px] md:inline-flex", rail.liveAi ? "text-ink-2" : "text-ink-3")} title={rail.liveAi ? `Live model ${model}` : "No OpenAI API key configured"}>
          <span className={cn("size-1.5 rounded-full", rail.liveAi ? "bg-teal" : "bg-ink-4")} />
          {rail.liveAi ? <>AI live <span className="font-mono text-[11.5px] text-ink-4">{model}</span></> : "AI unavailable"}
        </span>
        <button onClick={() => window.dispatchEvent(new Event("sirrom:advisor"))} className="hidden items-center gap-1.5 rounded-[7px] px-2.5 py-1.5 text-[13px] text-ink-2 hover:bg-ink/5 sm:inline-flex">
          <MessageSquareText className="size-[15px]" /> Ask
        </button>
        {rail.isSample && slug && <DemoModeButton slug={slug} liveAi={rail.liveAi} />}
      </div>
    </header>
  );
}
