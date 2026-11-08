"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Play, XCircle, RotateCcw, ShieldCheck, Download, Gauge, TrendingUp, Wallet, User, Sparkles, Mail } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/client";
import { DraftEditor } from "./draft-dialog";
import { EmptyState } from "./status";

interface Task { id: string; source_agent: string; priority: string; title: string; explanation: string | null; record_refs: Array<{ type: string; id: string; label?: string }>; assignee: string | null; status: string; completed_at: string | null; dismissed_reason: string | null; created_at: string }
interface DraftRow { id: string; kind: string; recipient: string | null; subject: string; body: string; status: string; written_by: string; created_at: string }
interface Pending { id: string; tool: string; summary: string; created_at: string }

const SOURCE: Record<string, { label: string; Icon: typeof Gauge; variant: "brand" | "green" | "amber" | "purple" | "default" }> = {
  readiness: { label: "Readiness", Icon: Gauge, variant: "brand" },
  sales: { label: "Sales", Icon: TrendingUp, variant: "green" },
  finance: { label: "Financial", Icon: Wallet, variant: "amber" },
  advisor: { label: "AI Advisor", Icon: Sparkles, variant: "purple" },
  owner: { label: "You", Icon: User, variant: "default" },
};
const PRIORITY: Record<string, string> = { high: "bg-rose-500", medium: "bg-amber-400", low: "bg-slate-300" };
const REF_HREF: Record<string, string> = { sales_opportunity: "/sales", invoice: "/finance", fix_action: "/readiness" };

export function ActionCenter({ tasks, drafts, pending }: { tasks: Task[]; drafts: DraftRow[]; pending: Pending[] }) {
  const [filter, setFilter] = useState<"active" | "done" | "dismissed">("active");
  const router = useRouter();
  const shown = tasks.filter((t) => (filter === "active" ? t.status === "open" || t.status === "in_progress" : t.status === filter));
  const counts = { active: tasks.filter((t) => t.status === "open" || t.status === "in_progress").length, done: tasks.filter((t) => t.status === "done").length, dismissed: tasks.filter((t) => t.status === "dismissed").length };

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <Card className="border-violet-200">
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4 text-violet-600" /> Waiting for your approval</CardTitle><CardDescription>Actions an agent prepared. Nothing happens until you approve.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {pending.map((p) => (
              <div key={p.id} className="flex flex-col gap-2 rounded-lg bg-violet-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-violet-950">{p.summary}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="success" onClick={async () => { const r = await api<{ summary?: string }>(`/api/pending/${p.id}`, { approve: true }); toast.success(r.summary ?? "Approved"); router.refresh(); }}>Approve</Button>
                  <Button size="sm" variant="secondary" onClick={async () => { await api(`/api/pending/${p.id}`, { approve: false }); router.refresh(); }}>Reject</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><CardTitle>Tasks</CardTitle><CardDescription>Created by your agents or by you. Readiness tasks close automatically once the data proves they&apos;re done.</CardDescription></div>
            <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm">
              {(["active", "done", "dismissed"] as const).map((f) => <button key={f} onClick={() => setFilter(f)} className={`rounded-md px-3 py-1 capitalize ${filter === f ? "bg-white font-medium shadow-sm" : "text-slate-600"}`}>{f} ({counts[f]})</button>)}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {shown.length === 0 ? <EmptyState title={filter === "active" ? "No open tasks" : `No ${filter} tasks`}>Agents add recommended tasks as they find things worth doing.</EmptyState> : (
            <ul className="space-y-3">{shown.map((t) => <TaskItem key={t.id} t={t} />)}</ul>
          )}
        </CardContent>
      </Card>

      <Card id="drafts">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><CardTitle className="flex items-center gap-2"><Mail className="size-4 text-slate-400" /> Message drafts</CardTitle><CardDescription>Review, edit and approve. Approved drafts can be copied or exported. Nothing is ever sent from this app.</CardDescription></div>
            <Button variant="secondary" size="sm" onClick={() => { window.location.href = "/api/drafts/export"; }}><Download /> Export approved drafts</Button>
          </div>
        </CardHeader>
        <CardContent>
          {drafts.length === 0 ? <EmptyState title="No drafts yet">Use &quot;Draft follow-up&quot; on Sales Intelligence or &quot;Draft reminder&quot; on Financial Intelligence.</EmptyState> : (
            <div className="grid gap-4 lg:grid-cols-2">
              {drafts.map((d) => (
                <div key={d.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="mb-2 text-xs text-slate-500">{d.kind === "sales_followup" ? "Sales follow-up" : "Payment reminder"} for <b className="text-slate-700">{d.recipient}</b> · {new Date(d.created_at).toLocaleDateString()}</div>
                  <DraftEditor draft={d} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TaskItem({ t }: { t: Task }) {
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState("");
  const [assignee, setAssignee] = useState(t.assignee ?? "Owner");
  const router = useRouter();
  const s = SOURCE[t.source_agent] ?? SOURCE.owner;
  const update = async (patch: Record<string, string>) => {
    await api(`/api/tasks/${t.id}`, patch, "PATCH");
    router.refresh();
  };
  return (
    <li className="rounded-xl border border-slate-200 p-4 animate-fade-in">
      <div className="flex flex-wrap items-start gap-3">
        <span className={`mt-1.5 size-2 shrink-0 rounded-full ${PRIORITY[t.priority]}`} title={`${t.priority} priority`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`font-medium ${t.status === "done" ? "text-slate-500 line-through" : ""}`}>{t.title}</span>
            <Badge variant={s.variant}><s.Icon className="size-3" /> {s.label}</Badge>
            <Badge>{t.priority}</Badge>
            {t.status === "in_progress" && <Badge variant="brand">In progress</Badge>}
          </div>
          {t.explanation && <p className="mt-1 text-sm text-slate-600">{t.explanation}</p>}
          {t.record_refs?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {t.record_refs.slice(0, 8).map((r) => <a key={r.id} href={REF_HREF[r.type] ?? "#"} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-brand-50 hover:text-brand-700">{r.label ?? r.type.replace("_", " ")}</a>)}
              {t.record_refs.length > 8 && <span className="text-[11px] text-slate-400">+{t.record_refs.length - 8} more</span>}
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>Created {new Date(t.created_at).toLocaleDateString()}</span>
            {t.completed_at && <span className="text-emerald-700">Completed {new Date(t.completed_at).toLocaleDateString()}</span>}
            {t.dismissed_reason && <span>Dismissed: {t.dismissed_reason}</span>}
            {(t.status === "open" || t.status === "in_progress") && (
              <span className="flex items-center gap-1">Assigned to <Input className="h-6 w-28 px-1.5 text-xs" value={assignee} onChange={(e) => setAssignee(e.target.value)} onBlur={() => assignee !== t.assignee && update({ assignee })} /></span>
            )}
          </div>
        </div>
        <div className="flex gap-1.5">
          {t.status === "open" && <Button size="sm" variant="ghost" onClick={() => update({ status: "in_progress" })}><Play /> Start</Button>}
          {(t.status === "open" || t.status === "in_progress") && <Button size="sm" variant="success" onClick={() => update({ status: "done" })}><CheckCircle2 /> Done</Button>}
          {(t.status === "open" || t.status === "in_progress") && <Button size="sm" variant="ghost" onClick={() => setDismissing(true)}><XCircle /> Dismiss</Button>}
          {(t.status === "done" || t.status === "dismissed") && <Button size="sm" variant="ghost" onClick={() => update({ status: "open" })}><RotateCcw /> Reopen</Button>}
        </div>
      </div>
      {dismissing && (
        <form className="mt-3 flex gap-2" onSubmit={async (e) => { e.preventDefault(); await update({ status: "dismissed", dismissed_reason: reason }); setDismissing(false); }}>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are you dismissing this? (e.g. already handled by phone)" autoFocus />
          <Button size="sm" type="submit" disabled={!reason.trim()}>Dismiss</Button>
          <Button size="sm" type="button" variant="ghost" onClick={() => setDismissing(false)}>Cancel</Button>
        </form>
      )}
    </li>
  );
}
