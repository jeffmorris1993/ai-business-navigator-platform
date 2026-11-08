"use client";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileSpreadsheet, Sparkles, Loader2, CheckCircle2, AlertTriangle, HelpCircle, Bookmark, Cog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/client";
import { toast } from "sonner";
import { RECORD_TYPES, type RecordType } from "@/lib/import/schemas";
import { validateMapping } from "@/lib/import/normalize";
import type { MappingSuggestion } from "@/lib/import/types";
import { ChangeList, type Change } from "./change-list";
import { useScanStream, ScanConsole } from "./scan-console";

interface Staged {
  stagingPath: string; filename: string; headers: string[]; sampleRows: Record<string, unknown>[]; rowCount: number; truncated: boolean;
  suggestion: MappingSuggestion; aiError: string | null; existingRecords: number;
}
interface CommitResult {
  ok: boolean; errors?: string[]; warnings: string[]; inserted?: number; updated?: number; issueCount?: number;
  issues?: Array<{ row: number; field: string; value: string; problem: string }>;
  assessment?: { changes: Change[] };
}

const STATUS_LABEL: Record<string, string> = { open: "Still open", won: "Won / sold", lost: "Lost / declined", booked: "Booked", completed: "Completed", cancelled: "Cancelled", no_show: "No-show" };

export function Importer({ samples = [], defaultMode, onDone, compact }: { samples?: Array<{ file: string; label: string }>; defaultMode?: "append" | "update" | "replace"; onDone?: (r: CommitResult) => void; compact?: boolean }) {
  const [staged, setStaged] = useState<Staged | null>(null);
  const [type, setType] = useState<RecordType>("sales_opportunity");
  const [columns, setColumns] = useState<Record<string, string | null>>({});
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"append" | "update" | "replace">(defaultMode ?? "append");
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const scan = useScanStream();
  const [skipped, setSkipped] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy("Reading your file and suggesting how the columns match...");
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const s = await api<Staged>("/api/import/stage", fd);
      setStaged(s);
      setType(s.suggestion.recordType);
      setColumns(Object.fromEntries(s.suggestion.columns.map((c) => [c.header, c.field])));
      setStatusMap(Object.fromEntries(s.suggestion.statusValues.filter((v) => v.suggested).map((v) => [v.raw, v.suggested!])));
      if (!defaultMode) setMode(s.existingRecords > 0 && (s.suggestion.recordType === "sales_opportunity" || s.suggestion.recordType === "invoice") ? "update" : "append");
    } catch {
      /* toast shown */
    } finally {
      setBusy(null);
    }
  }

  async function loadSample(file: string) {
    const res = await fetch(`/samples/${file}`);
    const blob = await res.blob();
    await upload(new File([blob], file));
  }

  const statusHeader = Object.entries(columns).find(([, f]) => f === "status")?.[0];
  const statusValues = useMemo(() => {
    if (!staged || !statusHeader) return [];
    const fromSuggestion = staged.suggestion.statusValues;
    return fromSuggestion.length ? fromSuggestion : [];
  }, [staged, statusHeader]);
  const unanswered = statusValues.filter((v) => !statusMap[v.raw]);
  const validation = staged ? validateMapping({ recordType: type, columns, statusMap }) : { errors: [], warnings: [] };

  async function commit() {
    if (!staged) return;
    setBusy("Checking every row, saving your records and re-running readiness checks...");
    setSkipped(null);
    try {
      const res = await fetch("/api/import/commit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ stagingPath: staged.stagingPath, filename: staged.filename, mapping: { recordType: type, columns, statusMap }, mode }) });
      if ((res.headers.get("content-type") ?? "").includes("application/json")) {
        const j = await res.json();
        if (!res.ok) { toast.error(j.error ?? "Import failed"); return; }
        setResult(j as CommitResult);
        return;
      }
      // Stream: import result first, then the automatically started intelligence scan.
      let imported: CommitResult | null = null;
      await scan.consume(res, (ev) => {
        if (ev.type === "import") {
          imported = ev.result as CommitResult;
          setResult(imported);
          setStaged(null);
          setBusy(null);
          onDone?.(imported);
          router.refresh();
        }
        if (ev.type === "scan_skipped") setSkipped(String(ev.reason));
      });
      router.refresh();
    } catch {
      toast.error("Import failed. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  if (busy) {
    return <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600"><Loader2 className="size-5 animate-spin text-brand-500" /> {busy}</div>;
  }

  if (result?.ok) {
    return (
      <div className="space-y-3 animate-fade-in">
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <CheckCircle2 className="mt-0.5 size-5 text-emerald-600" />
          <div className="text-sm">
            <div className="font-medium text-emerald-900">Import complete</div>
            <div className="text-emerald-800">{result.inserted ? `${result.inserted} records added. ` : ""}{result.updated ? `${result.updated} existing records updated. ` : ""}{result.issueCount ? `${result.issueCount} values couldn't be read and were left blank (not guessed).` : "Every value was read successfully."}</div>
          </div>
        </div>
        {!!result.warnings.length && result.warnings.map((w) => <div key={w} className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{w}</div>)}
        {result.assessment && <ChangeList changes={result.assessment.changes} />}
        {!!result.issues?.length && (
          <details className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <summary className="cursor-pointer font-medium text-slate-700">Values left blank ({result.issueCount})</summary>
            <ul className="mt-2 space-y-1 text-xs text-slate-600">{result.issues.slice(0, 20).map((i, n) => <li key={n}>Row {i.row}, {i.field}: &quot;{i.value}&quot; — {i.problem}</li>)}</ul>
          </details>
        )}
        {(scan.state.running || scan.state.done || scan.state.error) && (
          <div>
            <div className="mt-2 text-[13px] font-medium text-ink">Your agents started investigating this import automatically</div>
            <ScanConsole state={scan.state} />
          </div>
        )}
        {skipped && <div className="rounded-md bg-subtle px-3 py-2 text-[13px] text-ink-2">{skipped}</div>}
        <Button variant="secondary" size="sm" onClick={() => { setResult(null); scan.reset(); }} disabled={scan.state.running}>Import another file</Button>
      </div>
    );
  }

  if (!staged) {
    return (
      <div className="space-y-3">
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) upload(f); }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white text-center transition hover:border-brand-400 hover:bg-brand-50/30 ${compact ? "p-5" : "p-8"}`}
        >
          <Upload className="size-6 text-slate-400" />
          <div className="mt-2 text-sm font-medium">Drop a spreadsheet here or click to choose</div>
          <div className="mt-0.5 text-xs text-slate-500">Excel (.xlsx) or CSV, up to 5 MB. Your column names don&apos;t need to match anything.</div>
          <input ref={fileRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
        </div>
        {samples.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500">Or use a fictional sample file:</span>
            {samples.map((s) => (
              <button key={s.file} onClick={() => loadSample(s.file)} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 font-medium text-slate-700 hover:border-brand-300 hover:text-brand-700">
                <FileSpreadsheet className="size-3.5" /> {s.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const def = RECORD_TYPES[type];
  const by = staged.suggestion.suggestedBy;
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center gap-2">
        <FileSpreadsheet className="size-4 text-slate-500" />
        <span className="text-sm font-medium">{staged.filename}</span>
        <span className="text-xs text-slate-500">· {staged.rowCount} rows{staged.truncated ? " (first 5,000 only)" : ""}</span>
        <span className="ml-auto">
          {by === "ai" && <Badge variant="purple"><Sparkles className="size-3" /> Suggested by AI</Badge>}
          {by === "rules" && <Badge><Cog className="size-3" /> Suggested by matching rules (live AI unavailable)</Badge>}
          {by === "saved" && <Badge variant="green"><Bookmark className="size-3" /> Using your saved mapping</Badge>}
        </span>
      </div>
      {staged.aiError && <div className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">The AI suggestion failed ({staged.aiError}), so matching rules were used instead. Please check the mapping.</div>}

      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-3 text-sm">
        <span className="text-slate-600">This looks like:</span>
        <Select value={type} onChange={(e) => { setType(e.target.value as RecordType); setColumns(Object.fromEntries(staged.headers.map((h) => [h, null]))); }} className="w-auto">
          {Object.entries(RECORD_TYPES).map(([k, d]) => <option key={k} value={k}>{d.label}</option>)}
        </Select>
        <span className="text-xs text-slate-500">{staged.suggestion.recordTypeReason}</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-3 py-2">Your column</th><th className="px-3 py-2">Example values</th><th className="px-3 py-2">Matches</th><th className="px-3 py-2">Why</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {staged.headers.map((h) => {
              const sug = staged.suggestion.columns.find((c) => c.header === h);
              return (
                <tr key={h}>
                  <td className="px-3 py-2 font-medium">{h}</td>
                  <td className="max-w-[14rem] truncate px-3 py-2 text-xs text-slate-500">{staged.sampleRows.slice(0, 3).map((r) => String(r[h] ?? "—")).join(" · ")}</td>
                  <td className="px-3 py-2">
                    <Select value={columns[h] ?? ""} onChange={(e) => setColumns((c) => ({ ...c, [h]: e.target.value || null }))} className="min-w-[11rem]">
                      <option value="">Don&apos;t import (keep in original)</option>
                      {def.fields.map((f) => <option key={f.key} value={f.key}>{f.label}{f.required ? " *" : ""}</option>)}
                    </Select>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {sug && sug.field === columns[h] && sug.field ? <span className={sug.confidence === "high" ? "text-emerald-700" : "text-amber-700"}>{sug.confidence === "high" ? "Confident" : "Likely"}: </span> : null}
                    {sug && sug.field === columns[h] ? sug.reason : columns[h] ? "Your choice" : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {statusHeader && statusValues.length > 0 && (
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium"><HelpCircle className="size-4 text-brand-500" /> What do the values in &quot;{statusHeader}&quot; mean?</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {statusValues.map((v) => (
              <div key={v.raw} className={`flex items-center gap-2 rounded-lg p-2 ${v.ambiguous && !statusMap[v.raw] ? "bg-amber-50 ring-1 ring-amber-200" : "bg-slate-50"}`}>
                <span className="min-w-0 flex-1 text-sm"><span className="font-medium">&quot;{v.raw}&quot;</span>{v.ambiguous && <span className="block text-xs text-amber-800">{v.question ?? "Could mean more than one thing. Please choose."}</span>}</span>
                <Select value={statusMap[v.raw] ?? ""} onChange={(e) => setStatusMap((m) => { const n = { ...m }; if (e.target.value) n[v.raw] = e.target.value; else delete n[v.raw]; return n; })} className="w-36">
                  <option value="">Choose...</option>
                  {(def.statuses ?? []).map((s) => <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>)}
                </Select>
              </div>
            ))}
          </div>
        </div>
      )}

      {staged.existingRecords > 0 && (type === "sales_opportunity" || type === "invoice") && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-3 text-sm">
          <span className="text-slate-600">You already have {staged.existingRecords} of these records.</span>
          <Select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className="w-auto">
            <option value="update">Update matching records, add new ones</option>
            <option value="append">Add all rows as new records</option>
            <option value="replace">Replace all existing records</option>
          </Select>
        </div>
      )}

      {validation.errors.map((e) => <div key={e} className="flex gap-2 rounded-lg bg-rose-50 p-2.5 text-sm text-rose-800"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{e}</div>)}
      {validation.warnings.map((w) => <div key={w} className="flex gap-2 rounded-lg bg-amber-50 p-2.5 text-sm text-amber-900"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{w}</div>)}
      {unanswered.length > 0 && <div className="text-xs text-amber-800">{unanswered.length} status value(s) unanswered. Those rows will be saved as &quot;unknown&quot; rather than guessed.</div>}
      {result && !result.ok && result.errors?.map((e) => <div key={e} className="rounded-lg bg-rose-50 p-2.5 text-sm text-rose-800">{e}</div>)}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setStaged(null)}>Cancel</Button>
        <Button onClick={commit} disabled={validation.errors.length > 0}>Confirm and import {staged.rowCount} rows</Button>
      </div>
    </div>
  );
}
