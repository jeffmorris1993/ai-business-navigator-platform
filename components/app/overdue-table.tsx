"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, ListPlus, Banknote, Loader2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { api } from "@/lib/client";
import { formatMoney } from "@/lib/calc/money";
import { DraftDialog, type Draft } from "./draft-dialog";

interface Row { id: string; invoice_no: string | null; customer: string | null; due_on: string; amount_due: number; total_amount: number | null; days_overdue: number; bucket: string; source: string | null }

export function OverdueTable({ rows, today }: { rows: Row[]; today: string }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pay, setPay] = useState<Row | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();
  const over30 = rows.filter((r) => r.days_overdue > 30);

  async function remind(r: Row) {
    setBusy(r.id);
    try {
      setDraft({ ...(await api<Draft>("/api/drafts", { kind: "payment_reminder", recordId: r.id })), recipient: r.customer });
    } finally {
      setBusy(null);
    }
  }
  async function task(list: Row[], title: string) {
    const r = await api<{ duplicate: boolean }>("/api/tasks", {
      title, source_agent: "finance", priority: "high",
      explanation: list.map((x) => `Invoice ${x.invoice_no} · ${x.customer} · ${formatMoney(x.amount_due, { cents: true })} · ${x.days_overdue} days overdue`).join("; "),
      record_refs: list.map((x) => ({ type: "invoice", id: x.id, label: `${x.invoice_no} ${x.customer}` })),
    });
    toast.success(r.duplicate ? "That task is already in your plan" : "Added to My Action Plan");
    router.refresh();
  }

  return (
    <>
      {over30.length > 0 && (
        <div className="mb-3 flex justify-end">
          <Button size="sm" variant="secondary" onClick={() => task(over30, `Review ${over30.length} invoices more than 30 days overdue`)}><ListPlus /> Create task for {over30.length} invoices over 30 days</Button>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-3 py-2">Invoice</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Due</th><th className="px-3 py-2 text-right">Still owed</th><th className="px-3 py-2"></th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2.5"><div className="font-medium">#{r.invoice_no ?? "—"}</div>{r.source && <div className="flex items-center gap-1 text-[11px] text-slate-400"><FileSpreadsheet className="size-3" />{r.source}</div>}</td>
                <td className="px-3 py-2.5">{r.customer}</td>
                <td className="px-3 py-2.5"><div>{r.due_on}</div><div className={`text-xs ${r.days_overdue > 30 ? "text-rose-600" : "text-amber-700"}`}>{r.days_overdue} days overdue</div></td>
                <td className="px-3 py-2.5 text-right"><div className="font-semibold">{formatMoney(r.amount_due, { cents: true })}</div>{r.total_amount != null && r.total_amount !== r.amount_due && <div className="text-[11px] text-slate-400">of {formatMoney(r.total_amount)} total</div>}</td>
                <td className="px-3 py-2.5">
                  <div className="flex justify-end gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => remind(r)} disabled={busy === r.id}>{busy === r.id ? <Loader2 className="animate-spin" /> : <BellRing />} Draft reminder</Button>
                    <Button size="sm" variant="secondary" onClick={() => setPay(r)}><Banknote /> Record payment</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {draft && <DraftDialog draft={draft} onClose={() => setDraft(null)} />}
      {pay && <PaymentDialog row={pay} today={today} onClose={() => setPay(null)} />}
    </>
  );
}

function PaymentDialog({ row, today, onClose }: { row: Row; today: string; onClose: () => void }) {
  const [amount, setAmount] = useState(String(row.amount_due));
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>Record a payment</DialogTitle>
        <DialogDescription>Invoice #{row.invoice_no} · {row.customer} · {formatMoney(row.amount_due, { cents: true })} still owed</DialogDescription>
        <form
          className="mt-4 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const r = await api<{ newBalance: number; overpayment: number }>("/api/records/payment", { invoiceId: row.id, amount: Number(amount), paidOn: date });
              toast.success(`Payment recorded. New balance ${formatMoney(r.newBalance, { cents: true })}${r.overpayment ? ` (overpaid by ${formatMoney(r.overpayment, { cents: true })})` : ""}.`);
              onClose();
              router.refresh();
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Amount received ($)</Label><Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
            <div className="space-y-1.5"><Label>Date received</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
          </div>
          <p className="text-xs text-slate-500">The invoice balance and all overdue totals update immediately.</p>
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Record payment</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
