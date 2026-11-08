"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, Plus, LogOut, Check } from "lucide-react";
import { api } from "@/lib/client";

export function SwitchBusiness({ current, businesses }: { current: { id: string; name: string; industry?: string | null }; businesses: Array<{ id: string; name: string; industry: string | null }> }) {
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
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-subtle">
        <span className="grid size-6 place-items-center rounded bg-subtle text-[11px] font-semibold text-ink-2 ring-1 ring-line">{current.name.slice(0, 1)}</span>
        <span className="text-[13px] font-medium text-ink">{current.name}</span>
        <ChevronsUpDown className="size-3.5 text-ink-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-10 z-50 w-72 rounded-lg border border-line bg-surface p-1 shadow-pop animate-fade-in">
            <div className="px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-4">Sample businesses</div>
            {businesses.map((b) => (
              <button key={b.id} onClick={() => pick(b.id)} className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left hover:bg-subtle">
                <span className="grid size-6 place-items-center rounded bg-subtle text-[11px] font-semibold text-ink-2 ring-1 ring-line">{b.name.slice(0, 1)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{b.name}</span>
                  <span className="block truncate text-xs text-ink-3">{b.industry ?? "Not set up yet"}</span>
                </span>
                {b.id === current.id && <Check className="size-3.5 text-cobalt" />}
              </button>
            ))}
            <div className="my-1 border-t border-line" />
            <a href="/start" className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-ink-2 hover:bg-subtle"><Plus className="size-3.5" /> Add a business</a>
            <button onClick={async () => { await api("/api/session", undefined, "DELETE"); router.push("/"); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-ink-2 hover:bg-subtle"><LogOut className="size-3.5" /> Sign out</button>
          </div>
        </>
      )}
    </div>
  );
}
