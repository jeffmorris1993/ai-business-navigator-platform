import Link from "next/link";
import { ownerPage } from "@/lib/page-auth";
import * as repo from "@/lib/db/repo";
import { loadReadinessInput } from "@/lib/readiness/engine";
import { RULES } from "@/lib/readiness/rules";
import { calculatePipeline, findStaleOpportunities, analyzeSalesTrends, analyzeAppointmentCapacity, findStalledProposals } from "@/lib/calc/sales";
import { demoToday } from "@/lib/calc/dates";
import { formatMoney } from "@/lib/calc/money";
import { liveAiAvailable } from "@/lib/ai/openai";
import { PageHeader, Stat, StatusPill, EmptyState } from "@/components/app/status";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AgentChat } from "@/components/app/agent-chat";
import { AreaIntelligence } from "@/components/app/area-intelligence";
import { StaleTable } from "@/components/app/stale-table";
import { TrendChart, CapacityChart } from "@/components/app/charts";
import { Wrench, TrendingUp, CalendarClock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ analyze?: string }> }) {
  const { businessId } = await ownerPage();
  const sp = await searchParams;
  const input = await loadReadinessInput(businessId);
  const files = await repo.listSourceFiles(businessId);
  const fileName = Object.fromEntries(files.map((f) => [f.id, f.filename]));
  const st = { pipeline: RULES.sales_pipeline(input), followup: RULES.missed_followup(input), trends: RULES.sales_trends(input), capacity: RULES.appointment_capacity(input) };
  const today = demoToday();
  const usable = (s: { status: string }) => s.status === "ready" || s.status === "partial";
  const pipeline = usable(st.pipeline) ? calculatePipeline(input.opps) : null;
  const stale = usable(st.followup) ? findStaleOpportunities(input.opps, today, 7) : null;
  const trends = usable(st.trends) ? analyzeSalesTrends(input.opps) : null;
  const capacity = usable(st.capacity) ? analyzeAppointmentCapacity(input.weeks) : null;
  const stalled = pipeline ? findStalledProposals(input.opps, today, 30) : null;
  const live = liveAiAvailable();

  return (
    <>
      <PageHeader title="Sales Intelligence" description="Your Sales Agent analyzes the sales records you've imported. Every number on this page is calculated directly from those records.">
        <div className="flex flex-wrap gap-1.5">
          <StatusPill status={st.pipeline.status} /> <StatusPill status={st.followup.status} />
        </div>
      </PageHeader>

      <AreaIntelligence businessId={businessId} agent="sales" kind="sales_followup" />

      {!pipeline && !capacity && (
        <EmptyState icon={<TrendingUp className="size-8" />} title="Sales analysis isn't available yet">
          {st.pipeline.missing[0] ?? "Upload your sales records to begin."}
          <div className="mt-4"><Button asChild size="sm"><Link href="/readiness"><Wrench /> Fix in My AI Readiness</Link></Button></div>
        </EmptyState>
      )}

      {pipeline && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Open estimates" value={pipeline.open.count} sub={`${formatMoney(pipeline.open.value)} potential pipeline value`} tone="brand" />
          <Stat label="Need follow-up" value={stale ? stale.stale.length : "—"} sub={stale ? `${formatMoney(stale.totalValue)} potential, no contact in 7+ days` : "Needs last-contact dates"} tone={stale ? "amber" : "default"} />
          <Stat label="Won" value={pipeline.won.count} sub={formatMoney(pipeline.won.value)} tone="green" />
          <Stat label="Historical win rate" value={pipeline.winRateOfDecided != null ? `${pipeline.winRateOfDecided}%` : "—"} sub={`Of ${pipeline.won.count + pipeline.lost.count} decided estimates. Not a prediction.`} />
        </div>
      )}

      {pipeline && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Missed follow-ups</CardTitle>
                <CardDescription>Open estimates with no recorded contact in more than 7 days, ranked by value and how long they&apos;ve waited.</CardDescription>
              </div>
              <StatusPill status={st.followup.status} />
            </div>
          </CardHeader>
          <CardContent>
            {stale ? (
              <>
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                  I found <b>{stale.stale.length} open estimates totaling {formatMoney(stale.totalValue)}</b> that may need follow-up. This is <b>potential pipeline value, not guaranteed revenue</b>.
                  {stale.excludedUnknownContact.length > 0 && <> {stale.excludedUnknownContact.length} estimate(s) with unknown contact dates were left out rather than guessed.</>}
                  {stale.excludedMissingContact.length > 0 && <> {stale.excludedMissingContact.length} estimate(s) have no contact date yet.</>}
                </div>
                <StaleTable rows={stale.stale.map((s) => ({ ...s, source: s.source_file_id ? `${fileName[s.source_file_id] ?? "file"}, row ${s.source_row}` : null }))} />
              </>
            ) : (
              <div className="flex flex-col items-start gap-3 rounded-xl bg-rose-50 p-4 text-sm text-rose-900 sm:flex-row sm:items-center sm:justify-between">
                <div><b>Needs more information.</b> {st.followup.missing[0]}. {st.followup.nextStep}</div>
                <Button asChild size="sm"><Link href="/readiness"><Wrench /> Fix This Now</Link></Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(pipeline || capacity) && (
        <Card className="mt-6" id="agent">
          <CardHeader>
            <CardTitle>Sales Agent</CardTitle>
            <CardDescription>The agent picks its own tools, inspects your records, runs the calculations above, and explains what to do. You can see every action it takes.</CardDescription>
          </CardHeader>
          <CardContent>
            <AgentChat agent="sales" liveAi={live} autoQuestion={sp.analyze === "1" ? "Analyze my sales opportunities. Which customers should I follow up with first?" : undefined} suggestions={["Analyze my sales opportunities", "Which customers should I follow up with?", "Where are my biggest sales opportunities?", "Draft follow-ups for my top 3 and add a task to review them"]} />
          </CardContent>
        </Card>
      )}

      {capacity && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CalendarClock className="size-4 text-slate-400" /> Unused appointment capacity</CardTitle>
            <CardDescription>{capacity.limitation}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <Stat label="Unused or cancelled slots" value={capacity.totalUnusedSlots} sub={`Over ${capacity.weeks} weeks`} />
              <Stat label="Average per week" value={capacity.avgUnusedSlotsPerWeek ?? "—"} sub="Empty + cancelled" />
              <Stat label="Estimated value per week" value={formatMoney(capacity.avgWeeklyUnusedValue)} sub="At your average service price" tone="amber" />
            </div>
            <CapacityChart rows={capacity.rows} />
          </CardContent>
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {trends && trends.points.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Sales trends</CardTitle><CardDescription>Estimates quoted and won per month (by quote date).</CardDescription></CardHeader>
            <CardContent><TrendChart points={trends.points} /></CardContent>
          </Card>
        )}
        {stalled && stalled.count > 0 && (
          <Card>
            <CardHeader><CardTitle>Stalled proposals</CardTitle><CardDescription>Open for more than 30 days without a decision: {stalled.count} worth {formatMoney(stalled.totalValue)} (potential).</CardDescription></CardHeader>
            <CardContent>
              <ul className="divide-y divide-slate-100 text-sm">
                {stalled.proposals.slice(0, 8).map((p) => <li key={p.id} className="flex justify-between py-2"><span>{p.customer}</span><span className="text-slate-500">{formatMoney(p.amount)} · {p.days_open} days</span></li>)}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {input.opps.length > 0 && (
        <details className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-medium">All {input.opps.length} sales records</summary>
          <div className="mt-3 max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="p-2">Customer</th><th className="p-2">Amount</th><th className="p-2">Quoted</th><th className="p-2">Last contact</th><th className="p-2">Status</th><th className="p-2">Source</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {input.opps.map((o) => (
                  <tr key={o.id}><td className="p-2">{o.customer ?? "—"}</td><td className="p-2">{formatMoney(o.amount)}</td><td className="p-2">{o.quoted_on ?? "—"}</td><td className="p-2">{o.last_contact_on ?? (o.last_contact_unknown ? "Unknown" : "—")}</td><td className="p-2 capitalize">{o.status}{o.raw_status ? <span className="text-xs text-slate-400"> ({o.raw_status})</span> : null}</td><td className="p-2 text-xs text-slate-500">{o.source_file_id ? `${fileName[o.source_file_id] ?? "file"} row ${o.source_row}` : "Entered in app"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </>
  );
}
