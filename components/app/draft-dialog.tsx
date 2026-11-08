"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, CheckCircle2, Sparkles, FileText } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/client";

export interface Draft { id: string; subject: string; body: string; written_by: string; status?: string; recipient?: string | null }

export function DraftEditor({ draft, onApproved }: { draft: Draft; onApproved?: () => void }) {
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [status, setStatus] = useState(draft.status ?? "draft");
  const [dirty, setDirty] = useState(false);
  const router = useRouter();
  async function approve() {
    if (dirty) await api(`/api/drafts/${draft.id}`, { action: "edit", subject, body }, "PATCH");
    const r = await api<{ note: string }>(`/api/drafts/${draft.id}`, { action: "approve" }, "PATCH");
    setStatus("approved");
    setDirty(false);
    toast.success(r.note);
    onApproved?.();
    router.refresh();
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {draft.written_by === "ai" ? <Badge variant="purple"><Sparkles className="size-3" /> Written by AI from your records</Badge> : <Badge><FileText className="size-3" /> Template (live AI unavailable)</Badge>}
        {status === "approved" ? <Badge variant="green"><CheckCircle2 className="size-3" /> Approved · not sent</Badge> : <Badge variant="amber">Draft · needs your review</Badge>}
      </div>
      <Input value={subject} onChange={(e) => { setSubject(e.target.value); setDirty(true); setStatus("draft"); }} aria-label="Subject" />
      <Textarea rows={9} value={body} onChange={(e) => { setBody(e.target.value); setDirty(true); setStatus("draft"); }} aria-label="Message" />
      <p className="text-xs text-slate-500">Nothing is sent from this app. No email account is connected. After approving, copy the message into your own email or export all approved drafts.</p>
      <div className="flex flex-wrap justify-end gap-2">
        {dirty && <Button variant="secondary" size="sm" onClick={async () => { await api(`/api/drafts/${draft.id}`, { action: "edit", subject, body }, "PATCH"); setDirty(false); toast.success("Saved"); }}>Save edits</Button>}
        <Button variant="secondary" size="sm" onClick={() => { navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`); toast.success("Copied to clipboard"); }}><Copy /> Copy</Button>
        {status !== "approved" && <Button variant="success" size="sm" onClick={approve}><CheckCircle2 /> Approve</Button>}
      </div>
    </div>
  );
}

export function DraftDialog({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>Review draft{draft.recipient ? ` for ${draft.recipient}` : ""}</DialogTitle>
        <DialogDescription>Edit anything you like, then approve.</DialogDescription>
        <div className="mt-4"><DraftEditor draft={draft} /></div>
      </DialogContent>
    </Dialog>
  );
}
