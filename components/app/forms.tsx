"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { api } from "@/lib/client";
import type { Change } from "./change-list";

export interface ExampleWeekInput { week_start: string; available_slots: number; booked: number; cancellations: number; unfilled_slots: number; avg_service_value: number; weekly_sales: number }

export function WeeklyForm({ onDone, examples = [], entered = [], companyName }: { onDone?: (c: Change[]) => void; examples?: ExampleWeekInput[]; entered?: string[]; companyName?: string }) {
  const [f, setF] = useState({ week_start: "2026-11-02", available_slots: "", booked: "", cancellations: "", unfilled_slots: "", avg_service_value: "", weekly_sales: "" });
  const [savedHere, setSavedHere] = useState<string[]>([]);
  const remaining = examples.filter((w) => !entered.includes(w.week_start) && !savedHere.includes(w.week_start));
  const fillExample = () => {
    const w = remaining[0];
    if (!w) return;
    setF({ week_start: w.week_start, available_slots: String(w.available_slots), booked: String(w.booked), cancellations: String(w.cancellations), unfilled_slots: String(w.unfilled_slots), avg_service_value: String(w.avg_service_value), weekly_sales: String(w.weekly_sales) });
  };
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const fields: Array<[keyof typeof f, string, string]> = [
    ["week_start", "Week starting", "date"], ["available_slots", "Appointment slots available", "number"], ["booked", "Appointments booked", "number"],
    ["cancellations", "Cancellations / no-shows", "number"], ["unfilled_slots", "Slots left empty", "number"], ["avg_service_value", "Average service price ($)", "number"], ["weekly_sales", "Total sales that week ($)", "number"],
  ];
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const r = await api<{ changes: Change[] }>("/api/records/week", f);
          setSavedHere((x) => [...x, f.week_start]);
          setF((x) => ({ ...x, available_slots: "", booked: "", cancellations: "", unfilled_slots: "", avg_service_value: "", weekly_sales: "" }));
          onDone?.(r.changes);
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      {examples.length > 0 && (
        <div className="flex flex-col gap-2 rounded-md border border-dashed border-line-strong bg-subtle/50 px-3 py-2.5 text-[12.5px] text-ink-2 sm:flex-row sm:items-center">
          <span className="flex-1">{remaining.length ? `${companyName ?? "This business"} keeps paper records. Fill the form from their book, ${remaining.length} example week${remaining.length === 1 ? "" : "s"} left, then click Save.` : `All of ${companyName ?? "this business"}'s example weeks are entered.`}</span>
          {remaining.length > 0 && <Button type="button" size="sm" variant="secondary" onClick={fillExample}>Fill week of {remaining[0].week_start}</Button>}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(([k, label, type]) => (
          <div key={k} className="space-y-1.5"><Label>{label}</Label><Input type={type} min={0} step="any" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} required={k === "week_start"} /></div>
        ))}
      </div>
      <div className="flex justify-end"><Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Save week</Button></div>
    </form>
  );
}

export function CashForm({ onDone }: { onDone?: (c: Change[]) => void }) {
  const [asOf, setAsOf] = useState("2026-11-08");
  const [cash, setCash] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const r = await api<{ changes: Change[] }>("/api/records/cash", { asOf, cash: Number(cash) });
          onDone?.(r.changes);
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="space-y-1.5"><Label>Cash in the bank ($)</Label><Input type="number" step="any" value={cash} onChange={(e) => setCash(e.target.value)} required className="w-44" /></div>
      <div className="space-y-1.5"><Label>As of</Label><Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="w-44" /></div>
      <Button type="submit" disabled={busy || !cash}>{busy && <Loader2 className="animate-spin" />} Save</Button>
    </form>
  );
}
