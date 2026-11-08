import Link from "next/link";
import { Suspense } from "react";
import { ownerPage } from "@/lib/page-auth";
import * as repo from "@/lib/db/repo";
import { db } from "@/lib/db/client";
import { loadReadinessInput } from "@/lib/readiness/engine";
import { assessAll } from "@/lib/readiness/rules";
import { calculatePipeline } from "@/lib/calc/sales";
import { findOverdueInvoices, financialSummary } from "@/lib/calc/finance";
import { demoToday } from "@/lib/calc/dates";
import { formatMoney } from "@/lib/calc/money";
import { liveAiAvailable } from "@/lib/ai/openai";
import { listFindings } from "@/lib/intelligence/findings";
import { latestScan } from "@/lib/intelligence/scan";
import { loadActivity } from "@/lib/intelligence/activity";
import { Stat, StatStrip, EmptyState } from "@/components/app/status";
import { IntelligenceBriefing } from "@/components/app/scan-console";
import { FindingList, FeaturedFinding, sortFindings } from "@/components/app/findings";
import { ActivityTimeline, timeAgo } from "@/components/app/activity-timeline";
import { BilledVsExpenses } from "@/components/app/charts";
import { Mail, ListChecks, ShieldCheck, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

function Section({ title, meta, action, children, className }: { title: string; meta?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={className}>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-[24px] leading-tight tracking-[-0.01em] text-ink">{title}</h2>
          {meta && <p className="mt-1 text-[13.5px] text-ink-3">{meta}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="group inline-flex shrink-0 items-center gap-1 text-[13.5px] font-medium text-cobalt hover:text-cobalt-700">{children}<ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" /></Link>;
}

export default async function OverviewPage() {
  const { businessId } = await ownerPage();
  const [b, input, findings, scan, activity, drafts, pending, tasks] = await Promise.all([
    repo.getBusiness(businessId),
    loadReadinessInput(businessId),
    listFindings(businessId, { open: true }),
    latestScan(businessId),
    loadActivity(businessId, 7),
    db().from("drafts").select("id,kind,recipient,subject,finding_id,written_by,created_at").eq("business_id", businessId).eq("status", "draft").order("created_at", { ascending: false }).limit(6),
    db().from("pending_actions").select("id,summary,created_at").eq("business_id", businessId).eq("status", "pending"),
    db().from("tasks").select("id,title,priority,finding_id,source_agent").eq("business_id", businessId).in("status", ["open", "in_progress"]).order("created_at", { ascending: false }).limit(6),
  ]);
  const today = demoToday();
  const live = liveAiAvailable();
  const caps = assessAll(input);
  const ready = caps.filter((r) => r.status === "ready").length;
  const pipeline = input.opps.length ? calculatePipeline(input.opps) : null;
  const overdue = input.invoices.length ? findOverdueInvoices(input.invoices, today) : null;
  const summary = input.invoices.length || input.expenses.length ? financialSummary(input.invoices, input.expenses, today) : null;
  const ranked = sortFindings(findings);
  const urgent = ranked.filter((f) => f.priority === "critical" || f.priority === "high").length;
  const linkedTasks = (tasks.data ?? []).filter((t) => t.finding_id);
  const preparedCount = (drafts.data?.length ?? 0) + (pending.data?.length ?? 0) + linkedTasks.length;
  const findingTitle = new Map(findings.map((f) => [f.id, f.title]));
  const [top, ...rest] = ranked;

  const n = urgent || findings.length;
  const headline = !scan
    ? "Your records are in. No AI investigation has run yet."
    : findings.length
      ? `${n} ${urgent ? "high-priority " : ""}${n === 1 ? "issue needs" : "issues need"} your attention`
      : "Nothing needs your attention right now.";
  const dateLine = new Date(today + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="space-y-14">
      <Suspense>
        <IntelligenceBriefing liveAi={live} hasPriorScan={Boolean(scan)} lastScan={scan ? { status: scan.status, started_at: scan.started_at, finished_at: scan.finished_at ?? null } : null}>
          <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-4">
            <span>{dateLine}</span><span className="h-px w-6 bg-line-strong" /><span>Daily briefing</span>
          </div>
          <h1 className="mt-4 max-w-[22ch] font-display text-[34px] leading-[1.08] tracking-[-0.02em] text-ink sm:text-display-xl">{headline}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-ink-3">
            {scan ? (
              <span>Last intelligence scan {timeAgo(scan.started_at)} · {scan.status === "completed" ? "completed" : scan.status === "running" ? "running" : "stopped before finishing"}{scan.mode === "software_only" ? " (software only)" : ""}</span>
            ) : <span>{input.opps.length} estimates, {input.invoices.length} invoices and {input.expenses.length} expenses on file, ready to investigate</span>}
            {preparedCount > 0 && <span>· <Link href="/actions" className="text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink">{preparedCount} item{preparedCount === 1 ? "" : "s"} prepared for your review</Link></span>}
          </div>
          {scan?.summary && scan.status === "completed" ? (
            <figure className="mt-7 max-w-2xl border-l-2 border-lime pl-5">
              <figcaption className="mb-2 text-[12px] font-medium text-ink-3">From your Intelligence Engine</figcaption>
              <blockquote className="line-clamp-5 text-[15.5px] leading-[1.65] text-ink-2">{scan.summary}</blockquote>
              <Link href="/activity" className="mt-2 inline-block text-[13px] font-medium text-cobalt hover:text-cobalt-700">Read the full briefing</Link>
            </figure>
          ) : !scan ? (
            <p className="mt-7 max-w-xl text-[15.5px] leading-[1.65] text-ink-2">
              Run a scan and your agents will work through {b.name}&apos;s records, find what&apos;s costing money or stalling, and prepare the follow-ups and tasks for you to approve.
            </p>
          ) : null}
        </IntelligenceBriefing>
      </Suspense>

      <StatStrip>
        <Stat label="Open pipeline" value={pipeline ? formatMoney(pipeline.open.value) : "—"} sub={pipeline ? `${pipeline.open.count} open estimates · potential, not guaranteed` : "No sales records"} />
        <Stat label="Overdue balance" value={overdue ? formatMoney(overdue.total) : "—"} sub={overdue ? `${overdue.count} invoice${overdue.count === 1 ? "" : "s"} past due` : "No invoices"} tone={overdue?.count ? "red" : "default"} />
        <Stat
          label="AI capabilities ready"
          value={<>{ready}<span className="text-[20px] font-normal text-ink-4"> / {caps.length}</span></>}
          sub={
            <span className="flex flex-col gap-2">
              <span className="flex gap-1" aria-hidden="true">{caps.map((c) => <span key={c.capability} className={c.status === "ready" ? "h-1.5 flex-1 rounded-full bg-teal" : c.status === "partial" ? "h-1.5 flex-1 rounded-full bg-amber/60" : "h-1.5 flex-1 rounded-full bg-line-strong"} />)}</span>
              <Link href="/readiness" className="hover:text-ink">See what&apos;s missing</Link>
            </span>
          }
        />
        <Stat label="Work queue" value={preparedCount + (tasks.data ?? []).filter((t) => !t.finding_id).length} sub="Drafts, approvals and tasks" tone={preparedCount ? "amber" : "default"} />
      </StatStrip>

      <div className="grid gap-14 xl:grid-cols-[minmax(0,1fr)_380px] xl:gap-12">
        <Section title="Priority intelligence" meta="Ranked by your agents. Dollar values are calculated by software from your records." action={findings.length ? <SectionLink href="/inbox">Inbox · {findings.length}</SectionLink> : undefined}>
          {top ? (
            <div className="space-y-6">
              <FeaturedFinding f={top} />
              {rest.length > 0 && <FindingList findings={rest.slice(0, 5)} start={1} />}
              {rest.length > 5 && <SectionLink href="/inbox">{rest.length - 5} more in the Inbox</SectionLink>}
            </div>
          ) : (
            <EmptyState title={scan ? "No open findings" : "No findings yet"}>{scan ? "Your agents didn't find anything that needs attention." : "Run an AI Intelligence Scan and your agents will investigate this business."}</EmptyState>
          )}
        </Section>

        <div className="space-y-12">
          <Section title="Ready for you" action={preparedCount ? <SectionLink href="/actions">Action Center</SectionLink> : undefined}>
            {preparedCount === 0 ? (
              <p className="border-y border-line py-6 text-[14px] leading-relaxed text-ink-3">Nothing waiting. Drafts and tasks your agents prepare appear here for approval.</p>
            ) : (
              <ul className="divide-y divide-line border-y border-line">
                {(pending.data ?? []).map((p) => (
                  <li key={p.id}><Link href="/actions" className="flex items-start gap-3 py-3.5 hover:bg-ink/[0.02]"><span className="grid size-7 shrink-0 place-items-center rounded-md bg-cobalt-50 text-cobalt"><ShieldCheck className="size-4" /></span><div className="min-w-0"><div className="text-[14px] font-medium text-ink">Needs your approval</div><div className="text-[13px] text-ink-3">{p.summary}</div></div></Link></li>
                ))}
                {(drafts.data ?? []).map((d) => (
                  <li key={d.id}><Link href="/actions#drafts" className="group flex items-start gap-3 py-3.5 hover:bg-ink/[0.02]"><span className="grid size-7 shrink-0 place-items-center rounded-md bg-subtle text-ink-2"><Mail className="size-4" /></span><div className="min-w-0 flex-1"><div className="truncate text-[14px] font-medium text-ink">{d.kind === "sales_followup" ? "Follow-up" : "Payment reminder"} for {d.recipient}</div><div className="truncate text-[13px] text-ink-3">{d.finding_id ? findingTitle.get(d.finding_id) ?? "Linked to a finding" : d.subject}</div><div className="mt-1 text-[12px] text-ink-4">Draft ready{d.written_by === "ai" ? " · written by AI" : ""} · not sent</div></div><ArrowRight className="mt-1.5 size-3.5 text-ink-4 transition group-hover:translate-x-0.5" /></Link></li>
                ))}
                {linkedTasks.map((t) => (
                  <li key={t.id}><Link href="/actions" className="flex items-start gap-3 py-3.5 hover:bg-ink/[0.02]"><span className="grid size-7 shrink-0 place-items-center rounded-md bg-subtle text-ink-2"><ListChecks className="size-4" /></span><div className="min-w-0"><div className="truncate text-[14px] font-medium text-ink">{t.title}</div><div className="text-[12.5px] capitalize text-ink-3">Task · {t.priority} priority</div></div></Link></li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Evidence trail" action={<SectionLink href="/activity">All activity</SectionLink>}>
            <ActivityTimeline items={activity} empty="Agent runs, software checks and your actions will appear here." />
          </Section>
        </div>
      </div>

      {summary && summary.months.length >= 3 && (
        <Section title="Billed vs. spent" meta="Invoice totals by issue month against recorded expenses.">
          <div className="rounded-panel border border-line bg-surface p-5 shadow-card"><BilledVsExpenses months={summary.months.slice(-6)} /></div>
        </Section>
      )}
    </div>
  );
}
