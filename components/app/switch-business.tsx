"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, Plus, LogOut, Check } from "lucide-react";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";

export interface SwitcherBusiness { id: string; name: string; industry: string | null }

function Initial({ name, dark }: { name: string; dark?: boolean }) {
  return <span className={cn("grid size-8 shrink-0 place-items-center rounded-md text-[13px] font-semibold", dark ? "bg-midnight-3 text-night ring-1 ring-midnight-line" : "bg-ink/[0.06] text-ink-2")}>{name.slice(0, 1)}</span>;
}

/** Business selector that lives at the top of the navigation rail. */
export function RailBusinessSwitcher({ current, businesses, isSample }: { current: SwitcherBusiness; businesses: SwitcherBusiness[]; isSample: boolean }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  async function pick(id: string) {
    await api("/api/session", { role: "owner", businessId: id });
    setOpen(false);
    router.push("/overview");
    router.refresh();
  }
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-2.5 rounded-lg border border-midnight-line bg-midnight-2 px-2.5 py-2 text-left transition-colors hover:bg-midnight-3">
        <Initial name={current.name} dark />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[13.5px] font-medium text-white">{current.name}</span>
          <span className="mt-0.5 flex items-center gap-1.5 truncate text-[11.5px] text-night-3">
            {isSample && <span className="rounded-[4px] bg-lime/15 px-1 text-[10px] font-medium uppercase tracking-[0.08em] text-lime">Sample</span>}
            <span className="truncate">{current.industry ?? "Not set up yet"}</span>
          </span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-night-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-[70vh] overflow-y-auto rounded-xl border border-line bg-surface p-1.5 text-ink shadow-pop animate-fade-in sm:w-80">
            <div className="px-2.5 pb-1 pt-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-4">Example companies · fictional</div>
            {businesses.map((b) => (
              <button key={b.id} onClick={() => pick(b.id)} className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left hover:bg-ink/[0.04]">
                <Initial name={b.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">{b.name}</span>
                  <span className="block truncate text-[12px] text-ink-3">{b.industry ?? "Not set up yet"}</span>
                </span>
                {b.id === current.id && <Check className="size-4 text-cobalt" />}
              </button>
            ))}
            <div className="my-1 border-t border-line" />
            <a href="/start" className="flex items-center gap-2 rounded-md px-2.5 py-2 text-[13.5px] text-ink-2 hover:bg-ink/[0.04]"><Plus className="size-4" /> Onboard a business</a>
            <button onClick={async () => { await api("/api/session", undefined, "DELETE"); router.push("/"); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[13.5px] text-ink-2 hover:bg-ink/[0.04]"><LogOut className="size-4" /> Sign out</button>
          </div>
        </>
      )}
    </div>
  );
}

/** Back-compat export for any older imports. */
export const SwitchBusiness = RailBusinessSwitcher;
