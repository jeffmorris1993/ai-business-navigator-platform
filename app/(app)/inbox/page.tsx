import Link from "next/link";
import { ownerPage } from "@/lib/page-auth";
import { db } from "@/lib/db/client";
import * as repo from "@/lib/db/repo";
import { listFindings, getFinding } from "@/lib/intelligence/findings";
import { categoryDef, VALUE_LABEL, type ValueKind } from "@/lib/intelligence/categories";
import { formatMoney } from "@/lib/calc/money";
import { daysBetween, demoToday } from "@/lib/calc/dates";
import { liveAiAvailable } from "@/lib/ai/openai";
import { PageHeader, EmptyState, Priority, AgentTag, AGENT_META } from "@/components/app/status";
import { FindingList, FindingStatus, sortFindings } from "@/components/app/findings";
import { FindingActions } from "@/components/app/finding-actions";
import { timeAgo } from "@/components/app/activity-timeline";
import { Inbox as InboxIcon, FileSpreadsheet, Mail, ListChecks, ShieldCheck, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const VIEWS = [
  { key: "open", label: "Open" },
  { key: "needs_review", label: "Needs review" },
  { key: "resolved", label: "Resolved" },
  { key: "dismissed", label: "Dismissed" },
];
const OPEN = ["new", "needs_review", "action_prepared", "in_progress"];

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ view?: string; agent?: string; f?: string }> }) {
  const { businessId } = await ownerPage();
  const sp = await searchParams;
  const view = VIEWS.some((v) => v.key === sp.view) ? sp.view! : "open";
  const all = await listFindings(businessId);
  const counts = Object.fromEntries(VIEWS.map((v) => [v.key, all.filter((f) => (v.key === "open" ? OPEN.includes(f.status) : f.status === v.key)).length]));
  let shown = all.filter((f) => (view === "open" ? OPEN.includes(f.status) : f.status === view));
  if (sp.agent) shown = shown.filter((f) => f.agent === sp.agent);
  shown = view === "open" || view === "needs_review" ? sortFindings(shown) : shown;
  const selected = sp.f ? await getFinding(businessId, sp.f) : shown[0] ?? null;
  const q = (o: Record<string, string | undefined>) => "?" + new URLSearchParams(Object.entries({ view, agent: sp.agent, ...o }).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      <PageHeader title="Intelligence Inbox" description="Everything your agents discovered, with the records behind it. Findings persist, are re-verified by software whenever your records change, and never duplicate." />
      <div className="mb-4 flex flex-wrap items-center gap-1 border-b border-line">
        {VIEWS.map((v) => (
          <Link key={v.key} href={q({ view: v.key, f: undefined })} className={cn("-mb-px border-b-2 px-3 py-2 text-[13px]", view === v.key ? "border-ink font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink")}>
            {v.label} <span className="tnum text-ink-4">{counts[v.key]}</span>
          </Link>
        ))}
        <div className="ml-auto flex gap-1 pb-1.5">
          {["", "sales", "finance", "readiness"].map((a) => (
            <Link key={a || "all"} href={q({ agent: a || undefined, f: undefined })} className={cn("rounded px-2 py-1 text-xs", (sp.agent ?? "") === a ? "bg-ink text-white" : "text-ink-3 hover:bg-subtle")}>{a ? AGENT_META[a].short : "All agents"}</Link>
          ))}
        </div>
      </div>

      {shown.length === 0 && !selected ? (
        <EmptyState icon={<InboxIcon className="size-7" />} title={view === "open" ? "No open findings" : `No ${view.replace("_", " ")} findings`}>
          {view === "open" ? <>Run an <Link href="/overview" className="text-cobalt hover:underline">AI Intelligence Scan</Link> and findings will appear here.</> : null}
        </EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div className="min-w-0">{shown.length ? <FindingList findings={shown} compact selectedId={selected?.id} /> : <p className="text-[13px] text-ink-3">Nothing in this view.</p>}</div>
          {selected && <FindingDetail businessId={businessId} id={selected.id} />}
        </div>
      )}
    </>
  );
}

async function FindingDetail({ businessId, id }: { businessId: string; id: string }) {
  const f = (await getFinding(businessId, id))!;
  const def = categoryDef(f.category);
  const ids = f.record_refs.map((r) => r.id);
  const today = demoToday();
  const [opps, invs, drafts, tasks, files, scanRow] = await Promise.all([
    def?.refType === "sales_opportunity" && ids.length ? db().from("sales_opportunities").select("id,customer,amount,quoted_on,last_contact_on,status,source_row,source_file_id").eq("business_id", businessId).in("id", ids) : Promise.resolve({ data: [] as never[] }),
    def?.refType === "invoice" && ids.length ? db().from("invoices").select("id,invoice_no,customer,due_on,total_amount,amount_due,source_row,source_file_id").eq("business_id", businessId).in("id", ids) : Promise.resolve({ data: [] as never[] }),
    db().from("drafts").select("id,kind,recipient,status,written_by").eq("business_id", businessId).eq("finding_id", id),
    db().from("tasks").select("id,title,status,completed_at").eq("business_id", businessId).eq("finding_id", id),
    repo.listSourceFiles(businessId),
    f.source_scan_id ? db().from("intelligence_scans").select("trigger,started_at").eq("id", f.source_scan_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const fileName = Object.fromEntries(files.map((x) => [x.id, x.filename]));
  const open = OPEN.includes(f.status);
  return (
    <div className="min-w-0 self-start rounded-lg border border-line bg-surface shadow-card lg:sticky lg:top-16">
      <div className="border-b border-line p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Priority p={f.priority} /><AgentTag agent={f.agent} /><span className="text-xs text-ink-4">{def?.label}</span><FindingStatus status={f.status} />
        </div>
        <h2 className="mt-2 text-[17px] font-semibold leading-snug tracking-tight">{f.title}</h2>
        {f.value != null && f.value_kind !== "none" && (
          <div className="mt-3 flex items-baseline gap-2">
            <span className="tnum text-2xl font-semibold tracking-tight">{f.value_kind === "expense_change" ? "+" : ""}{formatMoney(f.value)}{f.value_kind === "expense_change" ? "/mo" : ""}</span>
            <span className="text-xs text-ink-3">{VALUE_LABEL[f.value_kind as ValueKind]} · calculated by software from {f.record_refs.length || "your"} record{f.record_refs.length === 1 ? "" : "s"}{f.value_kind === "potential_pipeline" ? " · not guaranteed revenue" : ""}</span>
          </div>
        )}
      </div>
      <div className="space-y-5 p-5">
        <div>
          <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-4">Why it matters</div>
          <p className="text-[13.5px] leading-relaxed text-ink-2">{f.explanation}</p>
        </div>
        {f.recommended_action && (
          <div className="rounded-md bg-subtle px-3.5 py-2.5">
            <div className="mb-0.5 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-4">Recommended action</div>
            <p className="text-[13.5px] text-ink">{f.recommended_action}</p>
          </div>
        )}
        {f.resolution_note && (
          <p className="flex items-start gap-1.5 text-[12.5px] text-teal-700"><ShieldCheck className="mt-0.5 size-3.5 shrink-0" />{f.resolved_by === "software_verified" ? "Verified by software: " : f.resolved_by === "ai_scan" ? "Closed by an AI scan: " : f.resolved_by === "owner" ? "Closed by you: " : ""}{f.resolution_note}</p>
        )}

        {(opps.data?.length || invs.data?.length) ? (
          <div>
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-4">Supporting records</div>
            <div className="overflow-x-auto rounded-md border border-line">
              <table className="w-full text-[12.5px]">
                <thead className="bg-subtle text-left text-[11px] text-ink-3">
                  {opps.data?.length ? <tr><th className="px-2.5 py-1.5 font-medium">Customer</th><th className="px-2.5 py-1.5 text-right font-medium">Estimate</th><th className="px-2.5 py-1.5 font-medium">Last contact</th><th className="hidden px-2.5 py-1.5 font-medium sm:table-cell">Source</th></tr>
                    : <tr><th className="px-2.5 py-1.5 font-medium">Invoice</th><th className="px-2.5 py-1.5 font-medium">Customer</th><th className="px-2.5 py-1.5 text-right font-medium">Still owed</th><th className="px-2.5 py-1.5 font-medium">Due</th><th className="hidden px-2.5 py-1.5 font-medium sm:table-cell">Source</th></tr>}
                </thead>
                <tbody className="divide-y divide-line">
                  {(opps.data ?? []).sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0)).map((o) => (
                    <tr key={o.id}><td className="px-2.5 py-1.5 font-medium">{o.customer}</td><td className="tnum px-2.5 py-1.5 text-right">{formatMoney(Number(o.amount))}</td><td className="px-2.5 py-1.5">{o.last_contact_on ? `${o.last_contact_on} · ${daysBetween(o.last_contact_on, today)}d ago` : "—"}{o.status !== "open" && <span className="ml-1 text-teal-700">({o.status})</span>}</td><td className="hidden px-2.5 py-1.5 text-ink-3 sm:table-cell"><FileSpreadsheet className="mr-1 inline size-3" />{o.source_file_id ? `${fileName[o.source_file_id] ?? "file"} r${o.source_row}` : "app"}</td></tr>
                  ))}
                  {(invs.data ?? []).map((i) => (
                    <tr key={i.id}><td className="px-2.5 py-1.5 font-medium">#{i.invoice_no}</td><td className="px-2.5 py-1.5">{i.customer}</td><td className={cn("tnum px-2.5 py-1.5 text-right", Number(i.amount_due) === 0 && "text-teal-700")}>{Number(i.amount_due) === 0 ? "Paid" : formatMoney(Number(i.amount_due), { cents: true })}</td><td className="px-2.5 py-1.5">{i.due_on}{i.due_on && Number(i.amount_due) > 0 && daysBetween(i.due_on, today) > 0 && <span className="text-red-700"> · {daysBetween(i.due_on, today)}d late</span>}</td><td className="hidden px-2.5 py-1.5 text-ink-3 sm:table-cell"><FileSpreadsheet className="mr-1 inline size-3" />{i.source_file_id ? `${fileName[i.source_file_id] ?? "file"} r${i.source_row}` : "app"}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        <div>
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-4">Prepared work</div>
          {(drafts.data?.length || tasks.data?.length) ? (
            <ul className="space-y-1 text-[13px]">
              {(drafts.data ?? []).map((d) => <li key={d.id}><Link href="/actions#drafts" className="flex items-center gap-2 hover:underline"><Mail className="size-3.5 text-ink-3" />{d.kind === "sales_followup" ? "Follow-up" : "Payment reminder"} for {d.recipient} <span className="text-xs text-ink-3">· {d.status === "approved" ? "approved, not sent" : "awaiting your review"}{d.written_by === "ai" ? " · written by AI" : ""}</span></Link></li>)}
              {(tasks.data ?? []).map((t) => <li key={t.id}><Link href="/actions" className="flex items-center gap-2 hover:underline"><ListChecks className="size-3.5 text-ink-3" />{t.title} <span className="text-xs capitalize text-ink-3">· {t.status.replace("_", " ")}</span></Link></li>)}
            </ul>
          ) : <p className="text-[13px] text-ink-3">Nothing prepared yet.</p>}
        </div>

        {open && <FindingActions id={f.id} title={f.title} canDraft={def?.refType === "invoice" || def?.refType === "sales_opportunity"} records={f.record_refs.map((r) => ({ id: r.id, label: r.label ?? r.id }))} liveAi={liveAiAvailable()} />}
        {!open && <FindingActions id={f.id} title={f.title} reopenOnly records={[]} liveAi={liveAiAvailable()} />}

        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3 text-[11.5px] text-ink-3">
          <span className="flex items-center gap-1"><Clock className="size-3" />Found {timeAgo(f.created_at)}{scanRow.data ? ` by ${({ manual: "a manual scan", import: "an import-triggered scan", follow_up: "a follow-up scan", software_only: "a software check" } as Record<string, string>)[scanRow.data.trigger] ?? "a scan"}` : ""}</span>
          <span>Last verified {timeAgo(f.last_verified_at)}</span>
          <span>Confirmed in {f.times_verified} scan{f.times_verified === 1 ? "" : "s"}</span>
          <span>Evidence: {f.evidence_quality.replace("_", " ")}</span>
          {f.dismissed_reason && <span>Dismissed: {f.dismissed_reason}</span>}
        </div>
      </div>
    </div>
  );
}
