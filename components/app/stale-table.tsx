"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquarePlus, ListPlus, Loader2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client";
import { formatMoney } from "@/lib/calc/money";
import { DraftDialog, type Draft } from "./draft-dialog";

interface Row { id: string; customer: string | null; amount: number | null; quoted_on: string | null; last_contact_on: string; days_since_contact: number; priority_reasons: string[]; source: string | null }

export function StaleTable({ rows }: { rows: Row[] }) {
  const [draft, setDraft] = useState<(Draft & { recipient: string | null }) | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();
  async function makeDraft(r: Row) {
    setBusy(r.id);
    try {
      const d = await api<Draft>("/api/drafts", { kind: "sales_followup", recordId: r.id });
      setDraft({ ...d, recipient: r.customer });
    } finally {
      setBusy(null);
    }
  }
  async function task(list: Row[], title: string) {
    const r = await api<{ duplicate: boolean }>("/api/tasks", {
      title, source_agent: "sales", priority: "high",
      explanation: `Open estimates with no recorded contact in 7+ days: ${list.map((x) => `${x.customer} (${formatMoney(x.amount)}, ${x.days_since_contact} days)`).join("; ")}. Potential pipeline value, not guaranteed revenue.`,
      record_refs: list.map((x) => ({ type: "sales_opportunity", id: x.id, label: x.customer ?? undefined })),
    });
    toast.success(r.duplicate ? "That task is already in your plan" : "Added to My Action Plan");
    router.refresh();
  }
  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button size="sm" variant="secondary" onClick={() => task(rows.slice(0, 5), `Review ${Math.min(5, rows.length)} outstanding estimates`)}><ListPlus /> Create task: review top {Math.min(5, rows.length)}</Button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Estimate</th><th className="px-3 py-2">Last contact</th><th className="px-3 py-2">Why it matters</th><th className="px-3 py-2"></th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <tr key={r.id} className="hover:bg-slate-50/60">
                <td className="px-3 py-2.5 text-slate-400">{i + 1}</td>
                <td className="px-3 py-2.5">
                  <div className="font-medium">{r.customer}</div>
                  {r.source && <div className="flex items-center gap-1 text-[11px] text-slate-400"><FileSpreadsheet className="size-3" /> {r.source}</div>}
                </td>
                <td className="px-3 py-2.5 font-medium">{formatMoney(r.amount)}</td>
                <td className="px-3 py-2.5"><div>{r.last_contact_on}</div><div className="text-xs text-amber-700">{r.days_since_contact} days ago</div></td>
                <td className="px-3 py-2.5 text-xs text-slate-600">{r.priority_reasons.join("; ")}<div className="mt-0.5 text-slate-400">Evidence: recorded quote & contact dates</div></td>
                <td className="px-3 py-2.5">
                  <div className="flex justify-end gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => makeDraft(r)} disabled={busy === r.id}>{busy === r.id ? <Loader2 className="animate-spin" /> : <MessageSquarePlus />} Draft follow-up</Button>
                    <Button size="sm" variant="ghost" onClick={() => task([r], `Follow up with ${r.customer}`)} title="Create task"><ListPlus /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {draft && <DraftDialog draft={draft} onClose={() => setDraft(null)} />}
    </>
  );
}
