import { ownerPage } from "@/lib/page-auth";
import * as repo from "@/lib/db/repo";
import { db } from "@/lib/db/client";
import { RECORD_TYPES, type RecordType } from "@/lib/import/schemas";
import { ALL_SAMPLES, SAMPLE_FILES } from "@/lib/samples/catalog";
import { presetFor } from "@/lib/samples/presets";
import { formatMoney } from "@/lib/calc/money";
import { PageHeader } from "@/components/app/status";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Importer } from "@/components/app/importer";
import { WeeklyForm, CashForm } from "@/components/app/forms";
import { ProfileForm } from "@/components/app/profile-form";
import { FileSpreadsheet, Download, Link2, PlugZap, BookOpen } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DataPage() {
  const { businessId } = await ownerPage();
  const [b, files, weeks, answers, mappings, cash] = await Promise.all([
    repo.getBusiness(businessId), repo.listSourceFiles(businessId), repo.listWeeks(businessId), repo.getAnswers(businessId),
    db().from("column_mappings").select("record_type,mapping,confirmed_at,suggested_by").eq("business_id", businessId).order("confirmed_at", { ascending: false }),
    repo.latestCash(businessId),
  ]);
  const own = Object.values(SAMPLE_FILES[b.slug ?? ""] ?? {}).flat() as Array<{ file: string; label: string }>;
  return (
    <>
      <PageHeader eyebrow="Sources" title="Data & Connections" description="Everything the agents are allowed to look at: files you've uploaded, numbers you've entered, and your answers. Original files are stored privately and every record links back to its source row." />
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Import a spreadsheet</CardTitle><CardDescription>Sales/estimates, invoices, payments, expenses or appointments. The Smart Data Importer suggests how your columns match; you confirm.</CardDescription></CardHeader>
            <CardContent><Importer samples={own.length ? own : ALL_SAMPLES.slice(0, 4)} /></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Uploaded files</CardTitle><CardDescription>Download the original any time to trace a finding back to its source.</CardDescription></CardHeader>
            <CardContent>
              {files.length ? (
                <ul className="divide-y divide-slate-100 text-sm">
                  {files.map((f) => (
                    <li key={f.id} className="flex items-center gap-3 py-2.5">
                      <FileSpreadsheet className="size-4 text-slate-400" />
                      <div className="min-w-0 flex-1"><div className="truncate font-medium">{f.filename}</div><div className="text-xs text-slate-500">{RECORD_TYPES[f.record_type as RecordType]?.label ?? f.record_type} · {f.row_count} rows · {f.import_mode} · {new Date(f.uploaded_at).toLocaleString()}</div></div>
                      <a href={`/api/source/${f.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"><Download className="size-3.5" /> Original</a>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-slate-500">No files yet.</p>}
            </CardContent>
          </Card>

          <Card id="weekly">
            <CardHeader><CardTitle>Weekly numbers (no spreadsheet needed)</CardTitle><CardDescription>For businesses that keep paper records. Copy a few totals each week; they&apos;re saved over time.</CardDescription></CardHeader>
            <CardContent className="space-y-5">
              <WeeklyForm examples={presetFor(b.slug)?.weeks ?? []} entered={weeks.map((w) => w.week_start)} companyName={b.name} />
              {weeks.length > 0 && (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-1">Week of</th><th>Booked</th><th>Cancelled</th><th>Empty</th><th>Avg price</th><th>Sales</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">{weeks.map((w) => <tr key={w.id}><td className="py-1.5">{w.week_start}</td><td>{w.booked ?? "—"}</td><td>{w.cancellations ?? "—"}</td><td>{w.unfilled_slots ?? "—"}</td><td>{formatMoney(w.avg_service_value)}</td><td>{formatMoney(w.weekly_sales)}</td></tr>)}</tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><PlugZap className="size-4 text-slate-400" /> Connections</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-lg bg-slate-50 p-2.5"><span>Spreadsheet uploads (CSV, Excel)</span><Badge variant="green">Active</Badge></div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 p-2.5"><span>Manual weekly entry</span><Badge variant="green">Active</Badge></div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 p-2.5"><span>QuickBooks direct connection</span><Badge>Not in prototype</Badge></div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 p-2.5"><span>Email sending</span><Badge>Not connected</Badge></div>
              <p className="pt-1 text-xs text-slate-500">Without an email connection, drafts are approved and copied, never sent automatically.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Cash on hand</CardTitle><CardDescription>{cash ? `Last entered: ${formatMoney(cash.cash_on_hand)} as of ${cash.as_of}` : "Needed for cash-flow scenarios."}</CardDescription></CardHeader>
            <CardContent><CashForm /></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Link2 className="size-4 text-slate-400" /> Saved column mappings</CardTitle><CardDescription>Reused automatically next time you upload a file with the same columns.</CardDescription></CardHeader>
            <CardContent>
              {(mappings.data ?? []).length ? (
                <ul className="space-y-2 text-xs">
                  {(mappings.data ?? []).map((m, i) => (
                    <li key={i} className="rounded-lg bg-slate-50 p-2.5">
                      <div className="mb-1 font-medium text-slate-700">{RECORD_TYPES[m.record_type as RecordType]?.label}</div>
                      {Object.entries(m.mapping as Record<string, string | null>).map(([h, f]) => <div key={h} className="text-slate-600">{h} → {f ? RECORD_TYPES[m.record_type as RecordType]?.fields.find((x) => x.key === f)?.label : <span className="text-slate-400">not imported</span>}</div>)}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-slate-500">None yet.</p>}
            </CardContent>
          </Card>

          <Card id="profile">
            <CardHeader><CardTitle>Your answers</CardTitle><CardDescription>Used by the readiness checks for process, people and privacy.</CardDescription></CardHeader>
            <CardContent><ProfileForm answers={answers} /></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="size-4 text-slate-400" /> Sample files</CardTitle><CardDescription>Fictional data for trying the importer.</CardDescription></CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm">{ALL_SAMPLES.map((s) => <li key={s.file}><a className="text-brand-600 hover:underline" href={`/samples/${s.file}`} download>{s.label}</a></li>)}</ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
