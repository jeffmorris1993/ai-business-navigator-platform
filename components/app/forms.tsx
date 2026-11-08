"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { api } from "@/lib/client";
import type { Change } from "./change-list";

export function WeeklyForm({ onDone }: { onDone?: (c: Change[]) => void }) {
  const [f, setF] = useState({ week_start: "2026-11-02", available_slots: "", booked: "", cancellations: "", unfilled_slots: "", avg_service_value: "", weekly_sales: "" });
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
          onDone?.(r.changes);
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
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
