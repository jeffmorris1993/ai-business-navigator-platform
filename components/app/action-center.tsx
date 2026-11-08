"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Play, XCircle, RotateCcw, ShieldCheck, Download, ChevronDown, Mail, Inbox } from "lucide-react";
import { toast } from "sonner";
import { SectionHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/client";
import { DraftEditor } from "./draft-dialog";
import { AgentTag, Priority } from "./status";
import { cn } from "@/lib/utils";

export interface Task { id: string; source_agent: string; priority: string; title: string; explanation: string | null; record_refs: Array<{ type: string; id: string; label?: string }>; assignee: string | null; status: string; completed_at: string | null; dismissed_reason: string | null; created_at: string; finding_id: string | null }
export interface DraftRow { id: string; kind: string; recipient: string | null; subject: string; body: string; status: string; written_by: string; created_at: string; approved_at: string | null; finding_id: string | null }
interface Pending { id: string; tool: string; summary: string; created_at: string }
export interface FindingLite { id: string; title: string; status: string; resolved_by: string | null; resolution_note: string | null; resolved_at: string | null; agent: string }

const REF_HREF: Record<string, string> = { sales_opportunity: "/sales", invoice: "/finance", fix_action: "/readiness" };

export function ActionCenter({ tasks, drafts, pending, findings }: { tasks: Task[]; drafts: DraftRow[]; pending: Pending[]; findings: FindingLite[] }) {
  const router = useRouter();
  const fmap = new Map(findings.map((f) => [f.id, f]));
  const awaitingDrafts = drafts.filter((d) => d.status === "draft");
  const prepared = tasks.filter((t) => t.status === "open" && (t.finding_id || t.source_agent !== "owner"));
  const ownerOpen = tasks.filter((t) => t.status === "open" && !t.finding_id && t.source_agent === "owner");
  const inProgress = tasks.filter((t) => t.status === "in_progress");
  const done = tasks.filter((t) => t.status === "done" || t.status === "dismissed");
  const approved = drafts.filter((d) => d.status === "approved");
  const outcomes = findings.filter((f) => f.status === "resolved");

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line shadow-card sm:grid-cols-4">
        {[["Awaiting your approval", pending.length + awaitingDrafts.length, "amber"], ["Prepared by AI", prepared.length, "brand"], ["In progress", inProgress.length, "default"], ["Verified outcomes", outcomes.filter((o) => o.resolved_by === "software_verified").length, "green"]].map(([l, v, t]) => (
          <div key={l as string} className="bg-surface px-4 py-3"><div className="text-xs text-ink-3">{l}</div><div className={cn("tnum mt-0.5 text-xl font-semibold", t === "amber" && "text-amber-700", t === "brand" && "text-cobalt-700", t === "green" && "text-teal-700")}>{v}</div></div>
        ))}
      </div>

      <section id="drafts">
        <SectionHeader title="Awaiting your approval" description="Messages and actions prepared by your agents. Nothing is sent or changed until you approve; approved messages are copied or exported, never sent from this app." action={<Button variant="secondary" size="sm" onClick={() => { window.location.href = "/api/drafts/export"; }}><Download /> Export approved drafts</Button>} />
        {pending.length + awaitingDrafts.length === 0 ? <Empty>Nothing waiting for approval.</Empty> : (
          <div className="space-y-2">
            {pending.map((p) => (
              <div key={p.id} className="flex flex-col gap-2 rounded-lg border border-line bg-surface px-4 py-3 shadow-card sm:flex-row sm:items-center">
                <ShieldCheck className="size-4 text-cobalt" />
                <span className="flex-1 text-[13px]">{p.summary}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="success" onClick={async () => { const r = await api<{ summary?: string }>(`/api/pending/${p.id}`, { approve: true }); toast.success(r.summary ?? "Approved"); router.refresh(); }}>Approve</Button>
                  <Button size="sm" variant="secondary" onClick={async () => { await api(`/api/pending/${p.id}`, { approve: false }); router.refresh(); }}>Reject</Button>
                </div>
              </div>
            ))}
            {awaitingDrafts.map((d) => <DraftItem key={d.id} d={d} finding={d.finding_id ? fmap.get(d.finding_id) : undefined} />)}
          </div>
        )}
      </section>

      <section>
        <SectionHeader title="Prepared by AI" description="Recommended tasks created by your agents, linked to the finding that prompted them." />
        {prepared.length === 0 ? <Empty>No open AI-prepared tasks.</Empty> : <TaskList tasks={prepared} fmap={fmap} />}
      </section>

      {(inProgress.length > 0 || ownerOpen.length > 0) && (
        <section>
          <SectionHeader title="In progress & your tasks" />
          <TaskList tasks={[...inProgress, ...ownerOpen]} fmap={fmap} />
        </section>
      )}

      <section>
        <SectionHeader title="Completed & outcomes" description="Software-verified outcomes are confirmed from your records (for example, an invoice that is now paid). Approvals and completed tasks are your actions, not verified results." />
        {outcomes.length + done.length + approved.length === 0 ? <Empty>Completed work and verified outcomes appear here.</Empty> : (
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface shadow-card">
            {outcomes.map((f) => (
              <li key={f.id} className="flex items-start gap-3 px-4 py-3">
                <CheckCircle2 className={cn("mt-0.5 size-4 shrink-0", f.resolved_by === "software_verified" ? "text-teal" : "text-ink-4")} />
                <div className="min-w-0 flex-1">
                  <Link href={`/inbox?view=resolved&f=${f.id}`} className="text-[13px] font-medium hover:underline">{f.title}</Link>
                  <div className="text-xs text-ink-3">{f.resolved_by === "software_verified" ? "Verified outcome · " : f.resolved_by === "owner" ? "Closed by you · " : "Closed by an AI scan · "}{f.resolution_note}</div>
                </div>
              </li>
            ))}
            {approved.map((d) => (
              <li key={d.id} className="flex items-start gap-3 px-4 py-3"><Mail className="mt-0.5 size-4 shrink-0 text-ink-4" /><div className="text-[13px]"><span className="font-medium">Approved {d.kind === "sales_followup" ? "follow-up" : "payment reminder"} for {d.recipient}</span><div className="text-xs text-ink-3">Owner-approved, not sent from this app{d.approved_at ? ` · ${new Date(d.approved_at).toLocaleDateString()}` : ""}</div></div></li>
            ))}
            {done.map((t) => (
              <li key={t.id} className="flex items-start gap-3 px-4 py-3">{t.status === "done" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ink-4" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-ink-4" />}<div className="min-w-0 flex-1 text-[13px]"><span className={cn("font-medium", t.status === "dismissed" && "text-ink-3")}>{t.title}</span><div className="text-xs text-ink-3">{t.status === "done" ? `Completed${t.completed_at ? ` ${new Date(t.completed_at).toLocaleDateString()}` : ""}` : `Dismissed: ${t.dismissed_reason}`}{t.explanation?.startsWith("Closed automatically") ? ` · ${t.explanation}` : ""}</div></div>
                <ReopenButton id={t.id} /></li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed border-line-strong px-4 py-5 text-center text-[13px] text-ink-3">{children}</div>;
}

function DraftItem({ d, finding }: { d: DraftRow; finding?: FindingLite }) {
  const [open, setOpen] = useState(false);
  const stale = finding?.status === "resolved";
  return (
    <div className="rounded-lg border border-line bg-surface shadow-card">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <Mail className="size-4 shrink-0 text-ink-3" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium">{d.kind === "sales_followup" ? "Follow-up" : "Payment reminder"} for {d.recipient}</div>
          <div className="truncate text-xs text-ink-3">{finding ? `For finding: ${finding.title}` : d.subject}{d.written_by === "ai" ? " · written by AI" : " · template"}{stale ? " · the issue has since been resolved; you may not need this" : ""}</div>
        </div>
        <ChevronDown className={cn("size-4 text-ink-4 transition", open && "rotate-180")} />
      </button>
      {open && <div className="border-t border-line p-4"><DraftEditor draft={d} /></div>}
    </div>
  );
}

function ReopenButton({ id }: { id: string }) {
  const router = useRouter();
  return <Button size="sm" variant="ghost" onClick={async () => { await api(`/api/tasks/${id}`, { status: "open" }, "PATCH"); router.refresh(); }}><RotateCcw /> Reopen</Button>;
}

function TaskList({ tasks, fmap }: { tasks: Task[]; fmap: Map<string, FindingLite> }) {
  return <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface shadow-card">{tasks.map((t) => <TaskItem key={t.id} t={t} finding={t.finding_id ? fmap.get(t.finding_id) : undefined} />)}</ul>;
}

function TaskItem({ t, finding }: { t: Task; finding?: FindingLite }) {
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState("");
  const [assignee, setAssignee] = useState(t.assignee ?? "Owner");
  const router = useRouter();
  const update = async (patch: Record<string, string>) => { await api(`/api/tasks/${t.id}`, patch, "PATCH"); router.refresh(); };
  return (
    <li className="px-4 py-3.5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><Priority p={t.priority} /><AgentTag agent={t.source_agent} />{t.status === "in_progress" && <span className="text-xs font-medium text-cobalt-700">In progress</span>}</div>
          <div className="mt-1 text-[13.5px] font-medium">{t.title}</div>
          {t.explanation && <p className="mt-0.5 line-clamp-2 text-[12.5px] text-ink-3">{t.explanation}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
            {finding && <Link href={`/inbox?f=${finding.id}`} className="inline-flex items-center gap-1 text-cobalt hover:underline"><Inbox className="size-3" />{finding.title}</Link>}
            {t.record_refs?.slice(0, 4).map((r) => <Link key={r.id} href={REF_HREF[r.type] ?? "#"} className="hover:underline">{r.label ?? r.type.replace("_", " ")}</Link>)}
            <span className="flex items-center gap-1">Assigned to <Input className="h-6 w-24 px-1.5 text-xs" value={assignee} onChange={(e) => setAssignee(e.target.value)} onBlur={() => assignee !== t.assignee && update({ assignee })} /></span>
          </div>
        </div>
        <div className="flex gap-1">
          {t.status === "open" && <Button size="sm" variant="ghost" onClick={() => update({ status: "in_progress" })}><Play /> Start</Button>}
          <Button size="sm" variant="secondary" onClick={() => update({ status: "done" })}><CheckCircle2 /> Done</Button>
          <Button size="sm" variant="ghost" onClick={() => setDismissing(true)}><XCircle /></Button>
        </div>
      </div>
      {dismissing && (
        <form className="mt-2.5 flex gap-2" onSubmit={async (e) => { e.preventDefault(); await update({ status: "dismissed", dismissed_reason: reason }); setDismissing(false); }}>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are you dismissing this?" autoFocus />
          <Button size="sm" type="submit" disabled={!reason.trim()}>Dismiss</Button>
          <Button size="sm" type="button" variant="ghost" onClick={() => setDismissing(false)}>Cancel</Button>
        </form>
      )}
    </li>
  );
}
