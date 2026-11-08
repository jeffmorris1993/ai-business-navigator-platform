"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, Upload, PencilLine, ArrowRight, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Importer } from "./importer";
import { ChangeList, type Change } from "./change-list";
import { WeeklyForm, CashForm, type ExampleWeekInput } from "./forms";
import { api } from "@/lib/client";
import { formatMoney } from "@/lib/calc/money";
import type { CapabilityResult } from "@/lib/readiness/rules";
import type { ProfileAnswers } from "@/lib/types";
import type { SampleFile } from "@/lib/samples/catalog";

export interface FixProps {
  fix: CapabilityResult;
  onClose: () => void;
  openMissing: Array<{ id: string; customer: string | null; amount: number | null; quoted_on: string | null; source_row: number | null; unknown: boolean }>;
  unknownStatuses: string[];
  answers: ProfileAnswers;
  samples: { sales: SampleFile[]; salesUpdate: SampleFile[]; invoices: SampleFile[]; expenses: SampleFile[] };
  weeks?: { examples: ExampleWeekInput[]; entered: string[]; companyName: string };
}

const TITLES: Record<string, { title: string; guide: string }> = {
  add_last_contact_dates: { title: "Add last-contact dates", guide: "Your sales information is organized well enough for me to review your open estimates and pipeline value. However, I can't reliably tell which customers need follow-up because your spreadsheet doesn't include when you last contacted them. Let's add a Last Contact Date so I can identify customers who may need follow-up. If you don't know a date, mark it unknown and I'll leave that estimate out instead of guessing." },
  upload_sales: { title: "Upload your sales records", guide: "Upload the spreadsheet where you track estimates or sales. Your column names don't need to match anything. I'll suggest how they line up, and you confirm." },
  resolve_statuses: { title: "Clarify your status values", guide: "Some status words in your records could mean more than one thing. Tell me what each means and I'll update the matching records." },
  upload_invoices: { title: "Upload your invoices", guide: "Export your invoice list (for example from QuickBooks: Reports → Open Invoices or Invoice List) and upload it. I need due dates and the amount still owed on each invoice." },
  fix_invoice_balances: { title: "Add unpaid balances", guide: "Your invoice file shows totals, but not how much is still owed. A total isn't the same as an unpaid balance, so I won't treat them as the same. Upload an export that includes Amount Due, Balance or Open Balance." },
  upload_expenses: { title: "Upload your expenses", guide: "Upload an expense list with a date, amount and ideally a category for each expense. A few months of history lets me compare periods fairly." },
  enter_cash: { title: "Enter your cash on hand", guide: "Cash-flow scenarios need a starting point: how much is in your business bank account today." },
  add_weekly_numbers: { title: "Enter weekly numbers", guide: "No spreadsheet needed. Copy a few totals from your appointment book. I'll use them to estimate unused capacity. I won't be able to identify individual customers from totals, and I won't invent any." },
  answer_privacy: { title: "Two quick privacy questions", guide: "Before I draft customer messages, please confirm you're allowed to contact these customers and that a person approves messages before they go out. These are your answers, not a legal review." },
};

export function FixDialog({ fix, onClose, openMissing, unknownStatuses, answers, samples, weeks }: FixProps) {
  const [changes, setChanges] = useState<Change[] | null>(null);
  const [summary] = useState<string | null>(null);
  // The importer shows its own result, readiness changes and the automatic intelligence scan, so stay on it.
  const [importChanges, setImportChanges] = useState<Change[]>([]);
  const imported = (r: { inserted?: number; updated?: number; issueCount?: number; assessment?: { changes: Change[] } }) => {
    setImportChanges(r.assessment?.changes ?? []);
  };
  const importUnlockedFollowup = importChanges.some((c) => c.capability === "missed_followup" && c.to === "ready");
  const importUnlockedOverdue = importChanges.some((c) => c.capability === "overdue_invoices" && c.to === "ready");
  const meta = TITLES[fix.fixAction!] ?? { title: "Fix this", guide: "" };
  const done = (c: Change[]) => setChanges(c);
  const unlockedFollowup = changes?.some((c) => c.capability === "missed_followup" && c.to === "ready");
  const unlockedOverdue = changes?.some((c) => c.capability === "overdue_invoices" && c.to === "ready");

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent wide>
        <DialogTitle>{meta.title}</DialogTitle>
        <DialogDescription>Guided fix from the AI Readiness Agent. Readiness re-checks automatically when you save.</DialogDescription>
        <div className="mt-4 flex gap-3 rounded-xl bg-brand-50 p-4">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-600 text-white"><Bot className="size-4" /></div>
          <p className="text-sm leading-relaxed text-brand-950">{meta.guide}</p>
        </div>
        <div className="mt-5">
          {changes ? (
            <div className="space-y-4">
              {summary && <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{summary}</div>}
              <ChangeList changes={changes} />
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="secondary" onClick={onClose}>Back to readiness</Button>
                {unlockedFollowup && <Button asChild><Link href="/sales?analyze=1">Analyze My Sales Opportunities <ArrowRight /></Link></Button>}
                {unlockedOverdue && <Button asChild><Link href="/finance">See overdue invoices <ArrowRight /></Link></Button>}
              </div>
            </div>
          ) : fix.fixAction === "add_last_contact_dates" ? (
            <ContactDatesFix rows={openMissing} samples={samples.salesUpdate} onDone={done} onImported={imported} />
          ) : fix.fixAction === "resolve_statuses" ? (
            <StatusFix values={unknownStatuses} onDone={done} />
          ) : fix.fixAction === "enter_cash" ? (
            <CashForm onDone={done} />
          ) : fix.fixAction === "add_weekly_numbers" ? (
            <div className="space-y-4">
              {importChanges.length > 0 && <ChangeList changes={importChanges} />}
              <WeeklyForm onDone={(c) => setImportChanges(c)} examples={weeks?.examples ?? []} entered={weeks?.entered ?? []} companyName={weeks?.companyName} />
            </div>
          ) : fix.fixAction === "answer_privacy" ? (
            <PrivacyFix answers={answers} onDone={done} />
          ) : (
            <Importer
              samples={fix.fixAction === "upload_sales" ? samples.sales : fix.fixAction === "upload_expenses" ? samples.expenses : samples.invoices}
              onDone={imported}
            />
          )}
          {!changes && (importUnlockedFollowup || importUnlockedOverdue) && (
            <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-line pt-4">
              {importUnlockedFollowup && <Button asChild><Link href="/sales?analyze=1">Analyze My Sales Opportunities <ArrowRight /></Link></Button>}
              {importUnlockedOverdue && <Button asChild><Link href="/finance">See overdue invoices <ArrowRight /></Link></Button>}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ContactDatesFix({ rows, samples, onDone, onImported }: { rows: FixProps["openMissing"]; samples: SampleFile[]; onDone: (c: Change[]) => void; onImported: (r: { inserted?: number; updated?: number; assessment?: { changes: Change[] } }) => void }) {
  const [tab, setTab] = useState<"enter" | "upload">(samples.length ? "upload" : "enter");
  const [vals, setVals] = useState<Record<string, { date: string; unknown: boolean }>>(() => Object.fromEntries(rows.map((r) => [r.id, { date: "", unknown: r.unknown }])));
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const filled = Object.values(vals).filter((v) => v.date || v.unknown).length;
  async function save() {
    setBusy(true);
    try {
      const updates = Object.entries(vals).filter(([, v]) => v.date || v.unknown).map(([id, v]) => ({ id, date: v.date || null, unknown: !v.date && v.unknown }));
      const r = await api<{ assessment: { changes: Change[] } }>("/api/records/contact-dates", { updates });
      onDone(r.assessment.changes);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <div className="mb-4 inline-flex rounded-lg bg-slate-100 p-1 text-sm">
        <button onClick={() => setTab("upload")} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 ${tab === "upload" ? "bg-white font-medium shadow-sm" : "text-slate-600"}`}><Upload className="size-3.5" /> Upload updated spreadsheet</button>
        <button onClick={() => setTab("enter")} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 ${tab === "enter" ? "bg-white font-medium shadow-sm" : "text-slate-600"}`}><PencilLine className="size-3.5" /> Enter dates here</button>
      </div>
      {tab === "upload" ? (
        <div>
          <p className="mb-3 text-sm text-slate-600">Add a &quot;Last Contact&quot; (or &quot;Last Call&quot;) column to your spreadsheet and upload it. I&apos;ll match rows to your existing estimates by customer and quote date and fill in the dates. Write &quot;Unknown&quot; where you don&apos;t know.</p>
          <Importer samples={samples} defaultMode="update" compact onDone={onImported} />
        </div>
      ) : (
        <div>
          <p className="mb-3 text-sm text-slate-600">{rows.length} open estimates have no last-contact date. Fill in what you know.</p>
          <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Estimate</th><th className="px-3 py-2">Quoted</th><th className="px-3 py-2">Last contact</th><th className="px-3 py-2">Unknown</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-1.5">{r.customer}<div className="text-[11px] text-slate-400">Row {r.source_row}</div></td>
                    <td className="px-3 py-1.5">{formatMoney(r.amount)}</td>
                    <td className="px-3 py-1.5 text-slate-500">{r.quoted_on}</td>
                    <td className="px-3 py-1.5"><Input type="date" className="h-8 w-40" value={vals[r.id]?.date ?? ""} max="2026-11-08" onChange={(e) => setVals((v) => ({ ...v, [r.id]: { date: e.target.value, unknown: false } }))} /></td>
                    <td className="px-3 py-1.5"><input type="checkbox" className="size-4 accent-brand-600" checked={vals[r.id]?.unknown && !vals[r.id]?.date} onChange={(e) => setVals((v) => ({ ...v, [r.id]: { date: "", unknown: e.target.checked } }))} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <button className="text-xs text-slate-500 underline" onClick={() => setVals((v) => Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x.date ? x : { date: "", unknown: true }])))}>Mark all remaining as unknown</button>
            <Button onClick={save} disabled={busy || filled === 0}>{busy && <Loader2 className="animate-spin" />} Save {filled} and re-check readiness</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusFix({ values, onDone }: { values: string[]; onDone: (c: Change[]) => void }) {
  const [m, setM] = useState<Record<string, string>>({});
  const router = useRouter();
  if (!values.length) return <p className="text-sm text-slate-500">No unclear status values found.</p>;
  return (
    <div className="space-y-2">
      {values.map((v) => (
        <div key={v} className="flex items-center gap-3 rounded-lg bg-slate-50 p-2.5">
          <span className="flex-1 text-sm">What does <b>&quot;{v}&quot;</b> mean?</span>
          <Select className="w-40" value={m[v] ?? ""} onChange={(e) => setM((x) => ({ ...x, [v]: e.target.value }))}><option value="">Choose...</option><option value="open">Still open</option><option value="won">Won / sold</option><option value="lost">Lost / declined</option></Select>
        </div>
      ))}
      <div className="flex justify-end pt-2"><Button disabled={!Object.keys(m).length} onClick={async () => { const r = await api<{ assessment: { changes: Change[] } }>("/api/records/statuses", { meanings: m }); onDone(r.assessment.changes); router.refresh(); }}>Save</Button></div>
    </div>
  );
}

function PrivacyFix({ answers, onDone }: { answers: ProfileAnswers; onDone: (c: Change[]) => void }) {
  const [a, setA] = useState({ customer_permission: answers.customer_permission ?? "", human_approval: answers.human_approval ?? "", financial_access: answers.financial_access ?? "" });
  const router = useRouter();
  return (
    <div className="space-y-4">
      <div className="space-y-1.5"><Label>Do you have permission to contact the customers in your records?</Label><Select value={a.customer_permission} onChange={(e) => setA({ ...a, customer_permission: e.target.value })}><option value="">Choose...</option><option value="yes">Yes</option><option value="no">No</option><option value="unsure">Unsure</option></Select></div>
      <div className="space-y-1.5"><Label>Will a person approve every message before it&apos;s sent?</Label><Select value={a.human_approval} onChange={(e) => setA({ ...a, human_approval: e.target.value })}><option value="">Choose...</option><option value="yes">Yes</option><option value="no">No</option></Select></div>
      <div className="space-y-1.5"><Label>Who can see your financial records?</Label><Input value={a.financial_access} onChange={(e) => setA({ ...a, financial_access: e.target.value })} placeholder="e.g. Owner and bookkeeper" /></div>
      <div className="flex justify-end"><Button onClick={async () => { const r = await api<{ changes: Change[] }>("/api/profile", a); onDone(r.changes); router.refresh(); }}>Save answers</Button></div>
    </div>
  );
}
