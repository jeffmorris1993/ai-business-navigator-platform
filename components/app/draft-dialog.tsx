"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, CheckCircle2, Sparkles, FileText, ShieldCheck, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";

export interface Draft { id: string; subject: string; body: string; written_by: string; status?: string; recipient?: string | null }

/** Explicit, safe approval: approving never sends anything. */
export function ApprovalPanel({ status, dirty, busy, onApprove, onCopy, onSave }: { status: string; dirty: boolean; busy: boolean; onApprove: () => void; onCopy: () => void; onSave: () => void }) {
  const approved = status === "approved";
  return (
    <div className={cn("rounded-xl p-4", approved ? "bg-teal/[0.07] ring-1 ring-teal/20" : "bg-surface ring-1 ring-line")}>
      <div className={cn("flex items-center gap-2 text-[13.5px] font-medium", approved ? "text-teal-700" : "text-ink")}>
        {approved ? <CheckCircle2 className="size-4" /> : <ShieldCheck className="size-4 text-cobalt" />}
        {approved ? "Approved · not sent" : "Your approval"}
      </div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-3">
        {approved
          ? "Marked ready. Copy it into your own email, or export all approved drafts. This app has no email account connected."
          : "Approving marks this message ready to copy or export. Nothing is sent from this app."}
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {!approved && <Button variant="success" onClick={onApprove} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Approve</Button>}
        {dirty && <Button variant="secondary" size="sm" onClick={onSave}>Save edits</Button>}
        <Button variant="secondary" size="sm" onClick={onCopy}><Copy /> Copy message</Button>
        {approved && <Button variant="ghost" size="sm" onClick={() => { window.location.href = "/api/drafts/export"; }}><Download /> Export approved drafts</Button>}
      </div>
    </div>
  );
}

export function DraftEditor({ draft, onApproved, context, approvedMessage }: { draft: Draft; onApproved?: () => void; context?: React.ReactNode; approvedMessage?: string }) {
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [status, setStatus] = useState(draft.status ?? "draft");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function save() { await api(`/api/drafts/${draft.id}`, { action: "edit", subject, body }, "PATCH"); setDirty(false); toast.success("Saved"); }
  async function approve() {
    setBusy(true);
    try {
      if (dirty) await api(`/api/drafts/${draft.id}`, { action: "edit", subject, body }, "PATCH");
      const r = await api<{ note: string }>(`/api/drafts/${draft.id}`, { action: "approve" }, "PATCH");
      setStatus("approved");
      setDirty(false);
      toast.success(approvedMessage ?? r.note);
      onApproved?.();
      router.refresh();
    } finally { setBusy(false); }
  }
  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_250px]">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
          {draft.written_by === "ai"
            ? <span className="inline-flex items-center gap-1.5 text-cobalt-700"><Sparkles className="size-3.5" /> Written by AI from your records</span>
            : <span className="inline-flex items-center gap-1.5 text-ink-3"><FileText className="size-3.5" /> Template (live AI unavailable)</span>}
          <span className="text-ink-4">·</span>
          <span className={status === "approved" ? "text-teal-700" : "text-amber-700"}>{status === "approved" ? "Approved · not sent" : "Draft · needs your review"}</span>
        </div>
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-ink-3">Subject</span>
          <Input value={subject} onChange={(e) => { setSubject(e.target.value); setDirty(true); setStatus("draft"); }} aria-label="Subject" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-ink-3">Message</span>
          <Textarea rows={12} value={body} onChange={(e) => { setBody(e.target.value); setDirty(true); setStatus("draft"); }} aria-label="Message" className="leading-relaxed" />
        </label>
      </div>
      <div className="space-y-4">
        {context}
        <ApprovalPanel status={status} dirty={dirty} busy={busy} onApprove={approve} onSave={save} onCopy={() => { navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`); toast.success("Copied to clipboard"); }} />
      </div>
    </div>
  );
}

export function DraftDialog({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogTitle>Review draft{draft.recipient ? ` for ${draft.recipient}` : ""}</DialogTitle>
        <DialogDescription>Edit anything you like, then approve. Nothing is sent from this app.</DialogDescription>
        <div className="mt-4"><DraftEditor draft={draft} /></div>
      </DialogContent>
    </Dialog>
  );
}
