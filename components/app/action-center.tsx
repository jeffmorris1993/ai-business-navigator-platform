"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Play, XCircle, RotateCcw, ShieldCheck, Download, Mail, Inbox, ListChecks, ArrowRight, BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { api } from "@/lib/client";
import { formatMoney } from "@/lib/calc/money";
import { DraftEditor } from "./draft-dialog";
import { AgentGlyph, AGENT_META, Priority } from "./status";
import { cn } from "@/lib/utils";

export interface Task { id: string; source_agent: string; priority: string; title: string; explanation: string | null; record_refs: Array<{ type: string; id: string; label?: string }>; assignee: string | null; status: string; completed_at: string | null; dismissed_reason: string | null; created_at: string; finding_id: string | null }
export interface DraftRow { id: string; kind: string; recipient: string | null; subject: string; body: string; status: string; written_by: string; created_at: string; approved_at: string | null; finding_id: string | null }
interface Pending { id: string; tool: string; summary: string; created_at: string }
export interface FindingLite { id: string; title: string; status: string; resolved_by: string | null; resolution_note: string | null; resolved_at: string | null; agent: string; value?: number | null; value_kind?: string }

const REF_HREF: Record<string, string> = { sales_opportunity: "/sales", invoice: "/finance", fix_action: "/readiness" };
type Tab = "approval" | "drafts" | "tasks" | "progress" | "completed" | "verified";

function age(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d}d ago`;
}

export function ActionCenter({ tasks, drafts, pending, findings }: { tasks: Task[]; drafts: DraftRow[]; pending: Pending[]; findings: FindingLite[] }) {
  const fmap = new Map(findings.map((f) => [f.id, f]));
  const awaitingDrafts = drafts.filter((d) => d.status === "draft");
  const prepared = tasks.filter((t) => t.status === "open");
  const inProgress = tasks.filter((t) => t.status === "in_progress");
  const done = tasks.filter((t) => t.status === "done" || t.status === "dismissed");
  const approved = drafts.filter((d) => d.status === "approved");
  const verified = findings.filter((f) => f.status === "resolved" && f.resolved_by === "software_verified");
  const closed = findings.filter((f) => f.status === "resolved" && f.resolved_by !== "software_verified");

  const tabs: Array<{ key: Tab; label: string; count: number }> = [
    { key: "approval", label: "Needs approval", count: pending.length },
    { key: "drafts", label: "Drafts ready", count: awaitingDrafts.length },
    { key: "tasks", label: "Prepared tasks", count: prepared.length },
    { key: "progress", label: "In progress", count: inProgress.length },
    { key: "completed", label: "Completed", count: done.length + approved.length + closed.length },
    { key: "verified", label: "Verified outcomes", count: verified.length },
  ];
  const initial: Tab = pending.length ? "approval" : awaitingDrafts.length ? "drafts" : prepared.length ? "tasks" : inProgress.length ? "progress" : "completed";
  const [tab, setTab] = useState<Tab>(initial);
  const [review, setReview] = useState<DraftRow | null>(null);
  useEffect(() => { if (window.location.hash === "#drafts" && awaitingDrafts.length) setTab("drafts"); }, [awaitingDrafts.length]);

  return (
    <div>
      <div role="tablist" aria-label="Work queue" className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-3 xl:grid-cols-6">
        {tabs.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={cn("relative bg-surface px-4 py-3.5 text-left transition-colors", tab === t.key ? "bg-surface" : "bg-canvas hover:bg-surface/70")}>
            {tab === t.key && <span className="absolute inset-x-0 top-0 h-[2px] bg-ink" />}
            <div className={cn("text-[12.5px]", tab === t.key ? "font-medium text-ink" : "text-ink-3")}>{t.label}</div>
            <div className={cn("tnum mt-1 text-[26px] font-semibold leading-none tracking-[-0.03em]", t.count === 0 ? "text-ink-4" : t.key === "verified" ? "text-teal-700" : t.key === "approval" || t.key === "drafts" ? "text-ink" : "text-ink-2")}>{t.count}</div>
          </button>
        ))}
      </div>

      <div id="drafts" role="tabpanel" className="animate-fade-in" key={tab}>
        {tab === "approval" && (
          <Queue empty="Nothing waiting for approval. Actions that change your records (like marking an invoice paid from the Advisor) wait here for you.">
            {pending.map((p) => <PendingItem key={p.id} p={p} />)}
          </Queue>
        )}
        {tab === "drafts" && (
          <>
            <QueueNote>Messages your agents prepared. Open one to review and edit. Approving marks it ready to copy or export. Nothing is sent from this app.</QueueNote>
            <Queue empty="No drafts waiting. Prepare one from any finding in the Inbox.">
              {awaitingDrafts.map((d) => <DraftItem key={d.id} d={d} finding={d.finding_id ? fmap.get(d.finding_id) : undefined} onOpen={() => setReview(d)} />)}
            </Queue>
          </>
        )}
        {tab === "tasks" && (
          <>
            <QueueNote>Recommended tasks created by your agents or by you, linked to the finding that prompted them.</QueueNote>
            <Queue empty="No open tasks.">{prepared.map((t) => <TaskItem key={t.id} t={t} finding={t.finding_id ? fmap.get(t.finding_id) : undefined} />)}</Queue>
          </>
        )}
        {tab === "progress" && <Queue empty="Nothing in progress. Start a task to move it here.">{inProgress.map((t) => <TaskItem key={t.id} t={t} finding={t.finding_id ? fmap.get(t.finding_id) : undefined} />)}</Queue>}
        {tab === "completed" && (
          <>
            <QueueNote action={approved.length ? <Button variant="secondary" size="sm" onClick={() => { window.location.href = "/api/drafts/export"; }}><Download /> Export approved drafts</Button> : undefined}>
              Your approvals and completed tasks. These are your actions, not verified results. Verified outcomes have their own tab.
            </QueueNote>
            <Queue empty="Completed work appears here.">
              {approved.map((d) => (
                <Row key={d.id} icon={<Mail className="size-4" />} title={`Approved ${d.kind === "sales_followup" ? "follow-up" : "payment reminder"} for ${d.recipient}`} meta={<>Owner-approved · not sent from this app{d.approved_at ? ` · ${new Date(d.approved_at).toLocaleDateString()}` : ""}</>} />
              ))}
              {closed.map((f) => (
                <Row key={f.id} icon={<CheckCircle2 className="size-4" />} title={<Link href={`/inbox?view=resolved&f=${f.id}`} className="hover:underline">{f.title}</Link>} meta={<>{f.resolved_by === "owner" ? "Closed by you" : "Closed by an AI scan"}{f.resolution_note ? ` · ${f.resolution_note}` : ""}</>} />
              ))}
              {done.map((t) => (
                <Row key={t.id} icon={t.status === "done" ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />} title={<span className={cn(t.status === "dismissed" && "text-ink-3")}>{t.title}</span>} meta={<>{t.status === "done" ? `Completed${t.completed_at ? ` ${new Date(t.completed_at).toLocaleDateString()}` : ""}` : `Dismissed: ${t.dismissed_reason}`}{t.explanation?.startsWith("Closed automatically") ? ` · ${t.explanation}` : ""}</>} action={<ReopenButton id={t.id} />} />
              ))}
            </Queue>
          </>
        )}
        {tab === "verified" && (
          <>
            <QueueNote>Outcomes software confirmed from your records, for example an overdue invoice that is now paid. These are results, not just actions.</QueueNote>
            <Queue empty="No verified outcomes yet. When your records show an issue is fixed, it appears here.">
              {verified.map((f) => (
                <li key={f.id} className="flex items-start gap-4 px-5 py-4">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-teal/10 text-teal"><BadgeCheck className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/inbox?view=resolved&f=${f.id}`} className="text-[14.5px] font-medium text-ink hover:underline">{f.title}</Link>
                    <div className="mt-0.5 text-[13px] text-teal-700">Verified from records · {f.resolution_note}</div>
                  </div>
                  {f.resolved_at && <span className="shrink-0 text-[12px] text-ink-3">{age(f.resolved_at)}</span>}
                </li>
              ))}
            </Queue>
          </>
        )}
      </div>

      <Sheet open={Boolean(review)} onOpenChange={(o) => !o && setReview(null)} title={review ? `Review ${review.kind === "sales_followup" ? "follow-up" : "payment reminder"} for ${review.recipient}` : ""} description="Edit anything you like. Approving does not send it.">
        {review && (
          <div className="p-6">
            <DraftEditor
              key={review.id}
              draft={review}
              approvedMessage={`Approved ${review.kind === "sales_followup" ? "follow-up" : "payment reminder"} for ${review.recipient} · not sent`}
              context={<DraftContext d={review} finding={review.finding_id ? fmap.get(review.finding_id) : undefined} />}
            />
          </div>
        )}
      </Sheet>
    </div>
  );
}

function QueueNote({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-2xl text-[13.5px] text-ink-3">{children}</p>{action}</div>;
}

function Queue({ children, empty }: { children: React.ReactNode; empty: string }) {
  const items = Array.isArray(children) ? children.flat().filter(Boolean) : children ? [children] : [];
  if (!items.length) return <div className="rounded-panel border border-dashed border-line-strong px-6 py-10 text-center text-[14px] text-ink-3">{empty}</div>;
  return <ul className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-surface shadow-card">{children}</ul>;
}

function Row({ icon, title, meta, action }: { icon: React.ReactNode; title: React.ReactNode; meta: React.ReactNode; action?: React.ReactNode }) {
  return (
    <li className="flex items-start gap-4 px-5 py-4">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-subtle text-ink-3">{icon}</span>
      <div className="min-w-0 flex-1"><div className="text-[14px] font-medium text-ink">{title}</div><div className="mt-0.5 text-[13px] text-ink-3">{meta}</div></div>
      {action}
    </li>
  );
}

function PendingItem({ p }: { p: Pending }) {
  const router = useRouter();
  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-cobalt-50 text-cobalt"><ShieldCheck className="size-4" /></span>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium text-ink">{p.summary}</div>
        <div className="mt-0.5 text-[12.5px] text-ink-3">Requested by the AI Advisor · {age(p.created_at)} · changes your records only if you approve</div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="success" onClick={async () => { const r = await api<{ summary?: string }>(`/api/pending/${p.id}`, { approve: true }); toast.success(r.summary ?? "Approved"); router.refresh(); }}>Approve</Button>
        <Button size="sm" variant="secondary" onClick={async () => { await api(`/api/pending/${p.id}`, { approve: false }); router.refresh(); }}>Reject</Button>
      </div>
    </li>
  );
}

function DraftItem({ d, finding, onOpen }: { d: DraftRow; finding?: FindingLite; onOpen: () => void }) {
  const stale = finding?.status === "resolved";
  return (
    <li>
      <button onClick={onOpen} className="group flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-ink/[0.02]">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-subtle text-ink-2"><Mail className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14.5px] font-medium text-ink">{d.kind === "sales_followup" ? "Follow-up" : "Payment reminder"} for {d.recipient}</div>
          <div className="mt-0.5 truncate text-[13px] text-ink-3">{finding ? finding.title : d.subject}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-4">
            {finding && <span className="flex items-center gap-1"><AgentGlyph agent={finding.agent} size={13} />{AGENT_META[finding.agent]?.short}</span>}
            <span>{d.written_by === "ai" ? "Written by AI" : "Template"}</span>
            <span>{age(d.created_at)}</span>
            <span className="text-amber-700">Not sent</span>
            {stale && <span className="text-teal-700">The issue has since been resolved; you may not need this</span>}
          </div>
        </div>
        <span className="mt-1 hidden shrink-0 items-center gap-1 text-[13px] font-medium text-cobalt sm:flex">Review <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" /></span>
      </button>
    </li>
  );
}

function DraftContext({ d, finding }: { d: DraftRow; finding?: FindingLite }) {
  return (
    <dl className="space-y-3 rounded-xl bg-subtle/60 p-4 text-[13px]">
      <div><dt className="text-[12px] text-ink-3">Recipient</dt><dd className="mt-0.5 font-medium text-ink">{d.recipient ?? "—"}</dd></div>
      <div><dt className="text-[12px] text-ink-3">Type</dt><dd className="mt-0.5 text-ink">{d.kind === "sales_followup" ? "Sales follow-up" : "Payment reminder"}</dd></div>
      {finding && (
        <div>
          <dt className="text-[12px] text-ink-3">Linked finding</dt>
          <dd className="mt-0.5"><Link href={`/inbox?f=${finding.id}`} className="font-medium text-cobalt hover:underline">{finding.title}</Link></dd>
          {finding.value != null && finding.value_kind !== "none" && <dd className="tnum mt-1 text-ink-2">{formatMoney(Number(finding.value))} <span className="text-ink-3">· calculated by software</span></dd>}
        </div>
      )}
    </dl>
  );
}

function ReopenButton({ id }: { id: string }) {
  const router = useRouter();
  return <Button size="sm" variant="ghost" onClick={async () => { await api(`/api/tasks/${id}`, { status: "open" }, "PATCH"); router.refresh(); }}><RotateCcw /> Reopen</Button>;
}

function TaskItem({ t, finding }: { t: Task; finding?: FindingLite }) {
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState("");
  const [assignee, setAssignee] = useState(t.assignee ?? "Owner");
  const router = useRouter();
  const update = async (patch: Record<string, string>) => { await api(`/api/tasks/${t.id}`, patch, "PATCH"); router.refresh(); };
  return (
    <li className="px-5 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <span className="hidden size-8 shrink-0 place-items-center rounded-full bg-subtle text-ink-2 sm:grid"><ListChecks className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Priority p={t.priority} />
            <span className="flex items-center gap-1.5 text-[12px] text-ink-3"><AgentGlyph agent={t.source_agent} size={14} />{AGENT_META[t.source_agent]?.short ?? "You"}</span>
            {t.status === "in_progress" && <span className="text-[12px] font-medium text-cobalt-700">In progress</span>}
            <span className="text-[12px] text-ink-4">{age(t.created_at)}</span>
          </div>
          <div className="mt-1.5 text-[14.5px] font-medium text-ink">{t.title}</div>
          {t.explanation && <p className="mt-0.5 line-clamp-2 text-[13px] leading-relaxed text-ink-3">{t.explanation}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-ink-3">
            {finding && <Link href={`/inbox?f=${finding.id}`} className="inline-flex items-center gap-1 text-cobalt hover:underline"><Inbox className="size-3.5" />{finding.title}</Link>}
            {t.record_refs?.slice(0, 4).map((r) => <Link key={r.id} href={REF_HREF[r.type] ?? "#"} className="hover:text-ink hover:underline">{r.label ?? r.type.replace("_", " ")}</Link>)}
            <label className="flex items-center gap-1.5">Assigned to <Input className="h-7 w-28 px-2 text-[12.5px]" value={assignee} onChange={(e) => setAssignee(e.target.value)} onBlur={() => assignee !== t.assignee && update({ assignee })} /></label>
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          {t.status === "open" && <Button size="sm" variant="ghost" onClick={() => update({ status: "in_progress" })}><Play /> Start</Button>}
          <Button size="sm" variant="secondary" onClick={() => update({ status: "done" })}><CheckCircle2 /> Done</Button>
          <Button size="sm" variant="ghost" onClick={() => setDismissing(true)} aria-label="Dismiss task"><XCircle /></Button>
        </div>
      </div>
      {dismissing && (
        <form className="mt-3 flex gap-2 sm:pl-12" onSubmit={async (e) => { e.preventDefault(); await update({ status: "dismissed", dismissed_reason: reason }); setDismissing(false); }}>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are you dismissing this?" autoFocus />
          <Button size="sm" type="submit" disabled={!reason.trim()}>Dismiss</Button>
          <Button size="sm" type="button" variant="ghost" onClick={() => setDismissing(false)}>Cancel</Button>
        </form>
      )}
    </li>
  );
}
