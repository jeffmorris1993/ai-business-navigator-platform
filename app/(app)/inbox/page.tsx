import Link from "next/link";
import { ownerPage } from "@/lib/page-auth";
import { db } from "@/lib/db/client";
import * as repo from "@/lib/db/repo";
import { listFindings, getFinding, type FindingRow } from "@/lib/intelligence/findings";
import { categoryDef, VALUE_LABEL, type ValueKind } from "@/lib/intelligence/categories";
import { formatMoney } from "@/lib/calc/money";
import { daysBetween, demoToday } from "@/lib/calc/dates";
import { liveAiAvailable } from "@/lib/ai/openai";
import { PageHeader, EmptyState, Priority, AgentGlyph, AGENT_META, PRIORITY_META } from "@/components/app/status";
import { FindingStatus, sortFindings, formatFindingValue } from "@/components/app/findings";
import { FindingActions } from "@/components/app/finding-actions";
import { InboxKeys } from "@/components/app/inbox-keys";
import { timeAgo } from "@/components/app/activity-timeline";
import { LinkTabs, Segmented } from "@/components/ui/tabs";
import { Inbox as InboxIcon, FileSpreadsheet, Mail, ListChecks, ShieldCheck, ArrowLeft, ArrowRight, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const VIEWS = [
  { key: "open", label: "Open" },
  { key: "needs_review", label: "Needs review" },
  { key: "resolved", label: "Resolved" },
  { key: "dismissed", label: "Dismissed" },
];
const OPEN = ["new", "needs_review", "action_prepared", "in_progress"];
const EVIDENCE: Record<string, string> = { verified_records: "Verified from your records", partial_records: "Partial records — some fields missing", owner_reported: "Reported by you, not from records" };

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
  const q = (o: Record<string, string | undefined>) => "/inbox?" + new URLSearchParams(Object.entries({ view, agent: sp.agent, ...o }).filter(([, v]) => v) as [string, string][]).toString();
  const hrefs = shown.map((f) => q({ f: f.id }));
  const idx = shown.findIndex((f) => f.id === selected?.id);
  const total = shown.reduce((s, f) => s + (f.value_kind !== "none" && f.value_kind !== "expense_change" ? f.value ?? 0 : 0), 0);

  return (
    <>
      <PageHeader eyebrow="Case management" title="Intelligence Inbox" description="Everything your agents discovered, with the records behind it. Findings persist, are re-verified by software whenever your records change, and never duplicate." />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <LinkTabs className="flex-1" items={VIEWS.map((v) => ({ href: q({ view: v.key, f: undefined }), label: v.label, count: counts[v.key], active: view === v.key }))} />
        <Segmented className="self-start sm:mb-1.5 sm:ml-6" items={["", "sales", "finance", "readiness"].map((a) => ({ href: q({ agent: a || undefined, f: undefined }), label: a ? AGENT_META[a].short : "All agents", active: (sp.agent ?? "") === a }))} />
      </div>

      {shown.length === 0 && !selected ? (
        <EmptyState icon={<InboxIcon className="size-7" />} title={view === "open" ? "No open findings" : `No ${view.replace("_", " ")} findings`}>
          {view === "open" ? <>Run an <Link href="/overview" className="text-cobalt hover:underline">AI Intelligence Scan</Link> and findings will appear here.</> : null}
        </EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)] xl:gap-8">
          <div className={cn("min-w-0", sp.f && "hidden lg:block")}>
            <div className="mb-2 flex items-center justify-between px-1 text-[12px] text-ink-3">
              <span>{shown.length} finding{shown.length === 1 ? "" : "s"}{total > 0 ? ` · ${formatMoney(total)} identified` : ""}</span>
              <span className="hidden items-center gap-1 lg:flex"><kbd className="rounded border border-line-strong bg-surface px-1 font-mono text-[10.5px]">↑</kbd><kbd className="rounded border border-line-strong bg-surface px-1 font-mono text-[10.5px]">↓</kbd> to move</span>
            </div>
            {shown.length ? (
              <ul className="overflow-hidden rounded-panel border border-line bg-surface shadow-card" aria-label="Findings">
                {shown.map((f) => <InboxRow key={f.id} f={f} href={q({ f: f.id })} selected={f.id === selected?.id} />)}
              </ul>
            ) : <p className="text-[13.5px] text-ink-3">Nothing in this view.</p>}
          </div>
          {selected && (
            <div className={cn("min-w-0", !sp.f && "hidden lg:block")}>
              <Link href={q({ f: undefined })} className="mb-3 inline-flex items-center gap-1 text-[13.5px] text-ink-3 hover:text-ink lg:hidden"><ArrowLeft className="size-4" /> All findings</Link>
              <FindingDetail businessId={businessId} id={selected.id} />
            </div>
          )}
        </div>
      )}
      {idx >= 0 && <InboxKeys hrefs={hrefs} current={idx} />}
    </>
  );
}

function InboxRow({ f, href, selected }: { f: FindingRow; href: string; selected: boolean }) {
  const v = formatFindingValue(f);
  return (
    <li className="border-b border-line last:border-b-0">
      <Link href={href} scroll={false} aria-current={selected ? "true" : undefined} className={cn("relative flex gap-3 px-4 py-3.5 transition-colors", selected ? "bg-cobalt-50/70" : "hover:bg-ink/[0.025]")}>
        {selected && <span className="absolute inset-y-0 left-0 w-[3px] bg-cobalt" />}
        <span className={cn("mt-1 h-8 w-[3px] shrink-0 rounded-full", PRIORITY_META[f.priority]?.bar ?? "bg-line-strong")} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className={cn("line-clamp-2 text-[14px] font-medium leading-snug", selected ? "text-cobalt-700" : "text-ink")}>{f.title}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-ink-3">
            <span className="flex items-center gap-1"><AgentGlyph agent={f.agent} size={14} />{AGENT_META[f.agent]?.short}</span>
            <span className="capitalize">{f.priority}</span>
            <FindingStatus status={f.status} />
          </div>
        </div>
        {v && <span className="tnum shrink-0 pt-px text-[13.5px] font-semibold text-ink">{v}</span>}
      </Link>
    </li>
  );
}

function Block({ title, icon, tone, children }: { title: string; icon: React.ReactNode; tone: "ai" | "software"; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-xl p-5", tone === "ai" ? "bg-cobalt-50/50 ring-1 ring-cobalt/10" : "bg-teal/[0.05] ring-1 ring-teal/15")}>
      <div className={cn("mb-3 flex items-center gap-2 text-[12.5px] font-medium", tone === "ai" ? "text-cobalt-700" : "text-teal-700")}>{icon}{title}</div>
      {children}
    </section>
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
  const v = formatFindingValue(f);
  const trigger = scanRow.data ? ({ manual: "a manual scan", import: "an import-triggered scan", follow_up: "a follow-up scan", software_only: "a software check" } as Record<string, string>)[scanRow.data.trigger] ?? "a scan" : null;
  const th = "px-3 py-2 font-medium";
  const td = "px-3 py-2";

  return (
    <article className="min-w-0 overflow-hidden rounded-panel border border-line bg-surface shadow-card" aria-label="Finding detail">
      <header className="border-b border-line px-6 pb-6 pt-5 sm:px-8">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <Priority p={f.priority} />
          <span className="flex items-center gap-1.5 text-[12.5px] text-ink-2"><AgentGlyph agent={f.agent} size={18} />{AGENT_META[f.agent]?.label}</span>
          <span className="text-[12.5px] text-ink-4">{def?.label}</span>
          <FindingStatus status={f.status} />
        </div>
        <h2 className="mt-3 font-display text-[28px] leading-[1.15] tracking-[-0.015em] text-ink">{f.title}</h2>
        {v && (
          <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="tnum text-[36px] font-semibold leading-none tracking-[-0.035em] text-ink">{v}</span>
            <span className="text-[13px] text-ink-3">{VALUE_LABEL[f.value_kind as ValueKind]}{f.value_kind === "potential_pipeline" ? " · not guaranteed revenue" : ""}</span>
          </div>
        )}
      </header>

      <div className="space-y-6 px-6 py-6 sm:px-8">
        <div className="grid gap-4 2xl:grid-cols-[1.5fr_1fr]">
          <Block tone="ai" title={`AI interpretation · ${AGENT_META[f.agent]?.label ?? "Agent"}`} icon={<Brain className="size-4" />}>
            <div className="text-[12px] font-medium text-ink-3">Why it matters</div>
            <p className="mt-1 text-[14.5px] leading-relaxed text-ink-2">{f.explanation}</p>
            {f.recommended_action && (
              <>
                <div className="mt-4 text-[12px] font-medium text-ink-3">Recommended action</div>
                <p className="mt-1 flex gap-2 text-[14.5px] leading-relaxed text-ink"><ArrowRight className="mt-1 size-4 shrink-0 text-cobalt" />{f.recommended_action}</p>
              </>
            )}
          </Block>
          <Block tone="software" title="Verified by software" icon={<ShieldCheck className="size-4" />}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px] sm:grid-cols-3 2xl:grid-cols-2">
              <div><dt className="text-ink-3">Value</dt><dd className="tnum mt-0.5 font-medium text-ink">{v ?? "No dollar value"}</dd></div>
              <div><dt className="text-ink-3">Qualifying records</dt><dd className="tnum mt-0.5 font-medium text-ink">{f.record_refs.length || "—"}</dd></div>
              <div><dt className="text-ink-3">Last verified</dt><dd className="mt-0.5 font-medium text-ink">{timeAgo(f.last_verified_at)}</dd></div>
              <div><dt className="text-ink-3">Confirmed in</dt><dd className="tnum mt-0.5 font-medium text-ink">{f.times_verified} scan{f.times_verified === 1 ? "" : "s"}</dd></div>
              <div className="col-span-2 sm:col-span-1 2xl:col-span-2"><dt className="text-ink-3">Evidence quality</dt><dd className="mt-0.5 font-medium text-ink">{EVIDENCE[f.evidence_quality] ?? f.evidence_quality.replace("_", " ")}</dd></div>
            </dl>
            {f.resolution_note && (
              <p className="mt-4 border-t border-teal/15 pt-3 text-[13px] leading-relaxed text-teal-700">{f.resolved_by === "software_verified" ? "Verified by software: " : f.resolved_by === "ai_scan" ? "Closed by an AI scan: " : f.resolved_by === "owner" ? "Closed by you: " : ""}{f.resolution_note}</p>
            )}
          </Block>
        </div>

        {(opps.data?.length || invs.data?.length) ? (
          <section>
            <h3 className="mb-2.5 text-[13.5px] font-medium text-ink">Supporting records <span className="font-normal text-ink-3">· the exact rows software used</span></h3>
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-[13px]">
                <thead className="bg-subtle/70 text-left text-[12px] text-ink-3">
                  {opps.data?.length ? <tr><th className={th}>Customer</th><th className={cn(th, "text-right")}>Estimate</th><th className={th}>Last contact</th><th className={cn(th, "hidden sm:table-cell")}>Source</th></tr>
                    : <tr><th className={th}>Invoice</th><th className={th}>Customer</th><th className={cn(th, "text-right")}>Still owed</th><th className={th}>Due</th><th className={cn(th, "hidden sm:table-cell")}>Source</th></tr>}
                </thead>
                <tbody className="divide-y divide-line">
                  {(opps.data ?? []).sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0)).map((o) => (
                    <tr key={o.id} className="hover:bg-ink/[0.015]"><td className={cn(td, "font-medium")}>{o.customer}</td><td className={cn(td, "tnum text-right")}>{formatMoney(Number(o.amount))}</td><td className={td}>{o.last_contact_on ? <>{o.last_contact_on} <span className="text-ink-3">· {daysBetween(o.last_contact_on, today)}d ago</span></> : "—"}{o.status !== "open" && <span className="ml-1 text-teal-700">({o.status})</span>}</td><td className={cn(td, "hidden text-ink-3 sm:table-cell")}><FileSpreadsheet className="mr-1 inline size-3.5" />{o.source_file_id ? `${fileName[o.source_file_id] ?? "file"} · row ${o.source_row}` : "Entered in app"}</td></tr>
                  ))}
                  {(invs.data ?? []).map((i) => (
                    <tr key={i.id} className="hover:bg-ink/[0.015]"><td className={cn(td, "font-medium")}>#{i.invoice_no}</td><td className={td}>{i.customer}</td><td className={cn(td, "tnum text-right", Number(i.amount_due) === 0 && "text-teal-700")}>{Number(i.amount_due) === 0 ? "Paid" : formatMoney(Number(i.amount_due), { cents: true })}</td><td className={td}>{i.due_on}{i.due_on && Number(i.amount_due) > 0 && daysBetween(i.due_on, today) > 0 && <span className="text-red-700"> · {daysBetween(i.due_on, today)}d late</span>}</td><td className={cn(td, "hidden text-ink-3 sm:table-cell")}><FileSpreadsheet className="mr-1 inline size-3.5" />{i.source_file_id ? `${fileName[i.source_file_id] ?? "file"} · row ${i.source_row}` : "Entered in app"}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <section>
          <h3 className="mb-2.5 text-[13.5px] font-medium text-ink">Prepared work</h3>
          {(drafts.data?.length || tasks.data?.length) ? (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {(drafts.data ?? []).map((d) => <li key={d.id}><Link href="/actions#drafts" className="flex items-center gap-3 px-3.5 py-2.5 text-[13.5px] hover:bg-ink/[0.02]"><Mail className="size-4 text-ink-3" /><span className="flex-1">{d.kind === "sales_followup" ? "Follow-up" : "Payment reminder"} for {d.recipient}</span><span className="text-[12px] text-ink-3">{d.status === "approved" ? "Approved · not sent" : "Awaiting your review"}{d.written_by === "ai" ? " · written by AI" : ""}</span></Link></li>)}
              {(tasks.data ?? []).map((t) => <li key={t.id}><Link href="/actions" className="flex items-center gap-3 px-3.5 py-2.5 text-[13.5px] hover:bg-ink/[0.02]"><ListChecks className="size-4 text-ink-3" /><span className="flex-1">{t.title}</span><span className="text-[12px] capitalize text-ink-3">{t.status.replace("_", " ")}</span></Link></li>)}
            </ul>
          ) : <p className="text-[13.5px] text-ink-3">Nothing prepared yet. Prepare a draft or create a task below.</p>}
        </section>

        <p className="text-[12.5px] text-ink-3">Found {timeAgo(f.created_at)}{trigger ? ` by ${trigger}` : ""}{f.dismissed_reason ? ` · Dismissed: ${f.dismissed_reason}` : ""}</p>
      </div>

      <footer className="sticky bottom-0 border-t border-line bg-surface/95 px-6 py-4 backdrop-blur-sm sm:px-8">
        {open
          ? <FindingActions id={f.id} title={f.title} canDraft={def?.refType === "invoice" || def?.refType === "sales_opportunity"} records={f.record_refs.map((r) => ({ id: r.id, label: r.label ?? r.id }))} liveAi={liveAiAvailable()} />
          : <FindingActions id={f.id} title={f.title} reopenOnly records={[]} liveAi={liveAiAvailable()} />}
      </footer>
    </article>
  );
}
