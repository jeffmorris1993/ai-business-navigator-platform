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
import { SectionHeader } from "@/components/ui/card";
import { ScanPanel } from "@/components/app/scan-console";
import { FindingList, sortFindings } from "@/components/app/findings";
import { ActivityTimeline, timeAgo } from "@/components/app/activity-timeline";
import { BilledVsExpenses } from "@/components/app/charts";
import { Mail, ListChecks, ShieldCheck, ArrowRight, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const { businessId } = await ownerPage();
  const [b, input, findings, scan, activity, drafts, pending, tasks] = await Promise.all([
    repo.getBusiness(businessId),
    loadReadinessInput(businessId),
    listFindings(businessId, { open: true }),
    latestScan(businessId),
    loadActivity(businessId, 8),
    db().from("drafts").select("id,kind,recipient,subject,finding_id,written_by,created_at").eq("business_id", businessId).eq("status", "draft").order("created_at", { ascending: false }).limit(6),
    db().from("pending_actions").select("id,summary,created_at").eq("business_id", businessId).eq("status", "pending"),
    db().from("tasks").select("id,title,priority,finding_id,source_agent").eq("business_id", businessId).in("status", ["open", "in_progress"]).order("created_at", { ascending: false }).limit(6),
  ]);
  const today = demoToday();
  const live = liveAiAvailable();
  const ready = assessAll(input).filter((r) => r.status === "ready").length;
  const pipeline = input.opps.length ? calculatePipeline(input.opps) : null;
  const overdue = input.invoices.length ? findOverdueInvoices(input.invoices, today) : null;
  const summary = input.invoices.length || input.expenses.length ? financialSummary(input.invoices, input.expenses, today) : null;
  const ranked = sortFindings(findings);
  const urgent = ranked.filter((f) => f.priority === "critical" || f.priority === "high").length;
  const preparedCount = (drafts.data?.length ?? 0) + (pending.data?.length ?? 0) + (tasks.data ?? []).filter((t) => t.finding_id).length;
  const findingTitle = new Map(findings.map((f) => [f.id, f.title]));

  const headline = !scan
    ? "Your records are in. No AI investigation has run yet."
    : findings.length
      ? `${urgent || findings.length} ${urgent ? "high-priority" : ""} ${(urgent || findings.length) === 1 ? "issue needs" : "issues need"} your attention`.replace("  ", " ")
      : "Nothing needs your attention right now.";

  return (
    <div className="space-y-9">
      <section className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="text-xs font-medium text-ink-3">{b.name} · {b.industry}</div>
          <h1 className="mt-1.5 text-[26px] font-semibold leading-tight tracking-tight text-ink">{headline}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-3">
            {scan ? (
              <span>Last intelligence scan {timeAgo(scan.started_at)} · {scan.status === "completed" ? "completed" : scan.status === "running" ? "running" : "stopped before finishing"}{scan.mode === "software_only" ? " (software only)" : ""}</span>
            ) : <span>{input.opps.length} estimates, {input.invoices.length} invoices and {input.expenses.length} expenses on file, ready to investigate</span>}
            {preparedCount > 0 && <span>· {preparedCount} item{preparedCount === 1 ? "" : "s"} prepared for your review</span>}
          </div>
          {scan?.summary && scan.status === "completed" && (
            <div className="mt-4 border-l-2 border-cobalt pl-3.5">
              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-4"><Sparkles className="size-3" /> Latest briefing from your agents</div>
              <p className="line-clamp-4 text-[13.5px] leading-relaxed text-ink-2">{scan.summary}</p>
              <Link href="/activity" className="mt-1 inline-block text-xs text-cobalt hover:underline">Full briefing and agent activity</Link>
            </div>
          )}
        </div>
      </section>

      <Suspense><ScanPanel liveAi={live} hasPriorScan={Boolean(scan)} /></Suspense>

      <StatStrip>
        <Stat label="Open pipeline" value={pipeline ? formatMoney(pipeline.open.value) : "—"} sub={pipeline ? `${pipeline.open.count} open estimates · potential, not guaranteed` : "No sales records"} />
        <Stat label="Overdue balance" value={overdue ? formatMoney(overdue.total) : "—"} sub={overdue ? `${overdue.count} invoice${overdue.count === 1 ? "" : "s"} past due` : "No invoices"} tone={overdue?.count ? "red" : "default"} />
        <Stat label="AI capabilities ready" value={<>{ready}<span className="text-base font-normal text-ink-4"> / 8</span></>} sub={<Link href="/readiness" className="hover:underline">See what&apos;s missing</Link>} tone="green" />
        <Stat label="Pending actions" value={preparedCount + (tasks.data ?? []).filter((t) => !t.finding_id).length} sub="Drafts, approvals and tasks" tone={preparedCount ? "amber" : "default"} />
      </StatStrip>

      <div className="grid gap-9 lg:grid-cols-[1.55fr_1fr]">
        <section>
          <SectionHeader title="Priority intelligence" description="Ranked by your agents. Values are calculated by software from your records." action={findings.length ? <Link href="/inbox" className="text-[13px] font-medium text-cobalt hover:underline">Inbox ({findings.length})</Link> : undefined} />
          {ranked.length ? <FindingList findings={ranked.slice(0, 5)} /> : (
            <EmptyState title={scan ? "No open findings" : "No findings yet"}>{scan ? "Your agents didn't find anything that needs attention." : "Run an AI Intelligence Scan and your agents will investigate this business."}</EmptyState>
          )}
        </section>

        <section>
          <SectionHeader title="Prepared for your review" action={preparedCount ? <Link href="/actions" className="text-[13px] font-medium text-cobalt hover:underline">Action Center</Link> : undefined} />
          <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-card">
            {preparedCount === 0 ? <p className="px-4 py-6 text-center text-[13px] text-ink-3">Nothing waiting. Prepared drafts and tasks appear here after a scan.</p> : (
              <ul className="divide-y divide-line">
                {(pending.data ?? []).map((p) => (
                  <li key={p.id}><Link href="/actions" className="flex items-start gap-3 px-4 py-3 hover:bg-subtle/60"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-cobalt" /><div className="min-w-0"><div className="text-[13px] font-medium">Needs your approval</div><div className="text-xs text-ink-3">{p.summary}</div></div></Link></li>
                ))}
                {(drafts.data ?? []).map((d) => (
                  <li key={d.id}><Link href="/actions#drafts" className="flex items-start gap-3 px-4 py-3 hover:bg-subtle/60"><Mail className="mt-0.5 size-4 shrink-0 text-ink-3" /><div className="min-w-0 flex-1"><div className="truncate text-[13px] font-medium">{d.kind === "sales_followup" ? "Follow-up" : "Payment reminder"} for {d.recipient}</div><div className="truncate text-xs text-ink-3">{d.finding_id ? `For: ${findingTitle.get(d.finding_id) ?? "a finding"}` : d.subject}{d.written_by === "ai" ? " · written by AI" : ""}</div></div><ArrowRight className="mt-0.5 size-3.5 text-ink-4" /></Link></li>
                ))}
                {(tasks.data ?? []).filter((t) => t.finding_id).map((t) => (
                  <li key={t.id}><Link href="/actions" className="flex items-start gap-3 px-4 py-3 hover:bg-subtle/60"><ListChecks className="mt-0.5 size-4 shrink-0 text-ink-3" /><div className="min-w-0"><div className="truncate text-[13px] font-medium">{t.title}</div><div className="text-xs capitalize text-ink-3">Task · {t.priority} priority</div></div></Link></li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-9 lg:grid-cols-[1fr_1.2fr]">
        <section>
          <SectionHeader title="Agent activity" action={<Link href="/activity" className="text-[13px] font-medium text-cobalt hover:underline">All activity</Link>} />
          <div className="rounded-lg border border-line bg-surface p-4 shadow-card"><ActivityTimeline items={activity} empty="Agent runs, software checks and your actions will appear here." /></div>
        </section>
        {summary && summary.months.length >= 3 && (
          <section>
            <SectionHeader title="Billed vs. spent" description="Invoice totals by issue month against recorded expenses." />
            <div className="rounded-lg border border-line bg-surface p-4 shadow-card"><BilledVsExpenses months={summary.months.slice(-6)} /></div>
          </section>
        )}
      </div>
    </div>
  );
}
