"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Building, Plus, LogOut } from "lucide-react";
import { api } from "@/lib/client";

export function SwitchBusiness({ current, businesses }: { current: { id: string; name: string }; businesses: Array<{ id: string; name: string; industry: string | null }> }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  async function pick(id: string) {
    await api("/api/session", { role: "owner", businessId: id });
    setOpen(false);
    router.push("/home");
    router.refresh();
  }
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold hover:bg-slate-100">
        <Building className="size-4 text-slate-400" /> {current.name} <ChevronDown className="size-4 text-slate-400" />
      </button>
      {open && (
        <div className="absolute left-0 top-11 z-50 w-72 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-fade-in">
          <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Sample businesses (fictional)</div>
          {businesses.map((b) => (
            <button key={b.id} onClick={() => pick(b.id)} className={`flex w-full flex-col rounded-lg px-2.5 py-2 text-left hover:bg-slate-50 ${b.id === current.id ? "bg-brand-50" : ""}`}>
              <span className="text-sm font-medium">{b.name}</span>
              <span className="text-xs text-slate-500">{b.industry ?? "Not set up yet"}</span>
            </button>
          ))}
          <div className="my-1 border-t border-slate-100" />
          <a href="/start" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-slate-50"><Plus className="size-4" /> Add a new business</a>
          <button onClick={async () => { await api("/api/session", undefined, "DELETE"); router.push("/"); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-slate-600 hover:bg-slate-50"><LogOut className="size-4" /> Sign out</button>
        </div>
      )}
    </div>
  );
}
