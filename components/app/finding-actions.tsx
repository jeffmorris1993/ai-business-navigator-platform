"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, ListPlus, Play, XCircle, CheckCircle2, MessageSquareText, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { api } from "@/lib/client";
import { DraftDialog, type Draft } from "./draft-dialog";

export function askAdvisor(question: string) {
  window.dispatchEvent(new CustomEvent("sirrom:ask", { detail: question }));
}

export function FindingActions({ id, title, canDraft, records, reopenOnly, liveAi }: { id: string; title: string; canDraft?: boolean; records: Array<{ id: string; label: string }>; reopenOnly?: boolean; liveAi: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [dismiss, setDismiss] = useState(false);
  const [reason, setReason] = useState("");
  const [recordId, setRecordId] = useState(records[0]?.id ?? "");
  const [draft, setDraft] = useState<Draft | null>(null);
  const router = useRouter();
  async function act(action: string, extra: Record<string, unknown> = {}, ok?: string) {
    setBusy(action);
    try {
      const r = await api<Record<string, unknown>>(`/api/findings/${id}`, { action, ...extra }, "PATCH");
      if (action === "draft") setDraft({ ...(r as unknown as Draft), recipient: records.find((x) => x.id === recordId)?.label });
      else if (ok) toast.success(ok);
      router.refresh();
    } catch { /* toast shown */ } finally { setBusy(null); }
  }
  const ask = () => askAdvisor(`Why did you flag "${title}" and what should I do first? (finding ${id})`);
  if (reopenOnly) {
    return <div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => act("reopen", {}, "Reopened")}><RotateCcw /> Reopen</Button>{liveAi && <Button size="sm" variant="ghost" onClick={ask}><MessageSquareText /> Ask about this</Button>}</div>;
  }
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {canDraft && records.length > 0 && (
          <span className="flex items-center gap-1">
            {records.length > 1 && <Select value={recordId} onChange={(e) => setRecordId(e.target.value)} className="h-7 w-40 text-xs">{records.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</Select>}
            <Button size="sm" onClick={() => act("draft", { recordId })} disabled={Boolean(busy)}>{busy === "draft" ? <Loader2 className="animate-spin" /> : <Mail />} Prepare draft</Button>
          </span>
        )}
        <Button size="sm" variant="secondary" onClick={() => act("task", {}, "Task added to the Action Center")} disabled={Boolean(busy)}><ListPlus /> Create task</Button>
        <Button size="sm" variant="secondary" onClick={() => act("in_progress", {}, "Marked in progress")} disabled={Boolean(busy)}><Play /> Start</Button>
        <Button size="sm" variant="ghost" onClick={() => act("resolve", {}, "Marked resolved")} disabled={Boolean(busy)}><CheckCircle2 /> Resolve</Button>
        <Button size="sm" variant="ghost" onClick={() => setDismiss(true)} disabled={Boolean(busy)}><XCircle /> Dismiss</Button>
        {liveAi && <Button size="sm" variant="ghost" onClick={ask}><MessageSquareText /> Ask about this</Button>}
      </div>
      {dismiss && (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); act("dismiss", { reason }, "Dismissed"); setDismiss(false); }}>
          <Input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why? (e.g. already handled by phone)" />
          <Button size="sm" type="submit" disabled={!reason.trim()}>Dismiss</Button>
        </form>
      )}
      {draft && <DraftDialog draft={draft} onClose={() => setDraft(null)} />}
    </div>
  );
}
