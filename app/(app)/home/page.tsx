import Link from "next/link";
import { ownerPage } from "@/lib/page-auth";
import * as repo from "@/lib/db/repo";
import { db } from "@/lib/db/client";
import { getReadinessReport, loadReadinessInput } from "@/lib/readiness/engine";
import { CAPABILITIES, RULES } from "@/lib/readiness/rules";
import { findStaleOpportunities, calculatePipeline, analyzeAppointmentCapacity } from "@/lib/calc/sales";
import { findOverdueInvoices, analyzeExpenses } from "@/lib/calc/finance";
import { demoToday } from "@/lib/calc/dates";
import { formatMoney } from "@/lib/calc/money";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/app/status";
import { ArrowRight, TrendingUp, Wallet, ListChecks, Sparkles, Gauge } from "lucide-react";

export const dynamic = "force-dynamic";

const EVENT_TEXT: Record<string, (p: Record<string, unknown>) => string | null> = {
  capability_activated: (p) => `New AI capability ready: ${p.label}`,
  data_imported: (p) => `Imported ${p.filename} (${p.inserted ?? 0} added, ${p.updated ?? 0} updated)`,
  records_updated: (p) => (p.field === "last_contact_on" ? `Added ${p.filled} contact dates, marked ${p.unknown} unknown` : "Records updated"),
  payment_recorded: (p) => `Payment of ${formatMoney(Number(p.amount), { cents: true })} recorded on invoice ${p.invoice_no}`,
  task_completed: () => "Completed a recommended action",
  draft_approved: () => "Approved a message draft",
  manual_entry: (p) => `Entered weekly numbers for ${p.week_start}`,
  agent_run: (p) => `${String(p.agent).replace(/^./, (c) => c.toUpperCase())} agent ran ${(p.tools as string[])?.length ?? 0} tool actions`,
  onboarded: () => "Completed onboarding",
};

export default async function HomePage() {
  const { businessId } = await ownerPage();
  const [b, input, report, events, tasks] = await Promise.all([
    repo.getBusiness(businessId), loadReadinessInput(businessId), getReadinessReport(businessId), repo.listEvents(businessId, 30),
    db().from("tasks").select("id,title,priority,source_agent,status").eq("business_id", businessId).in("status", ["open", "in_progress"]).order("created_at", { ascending: false }),
  ]);
  const today = demoToday();
  const current = report?.current ?? [];
  const ready = current.filter((c) => c.status === "ready").length;
  const usable = (k: keyof typeof RULES) => ["ready", "partial"].includes(RULES[k](input).status);
  const stale = usable("missed_followup") ? findStaleOpportunities(input.opps, today) : null;
  const pipeline = usable("sales_pipeline") ? calculatePipeline(input.opps) : null;
  const capacity = usable("appointment_capacity") ? analyzeAppointmentCapacity(input.weeks) : null;
  const overdue = usable("overdue_invoices") ? findOverdueInvoices(input.invoices, today) : null;
  const expenses = usable("expense_trends") ? analyzeExpenses(input.expenses, today) : null;
  const rank = { high: 0, medium: 1, low: 2 } as Record<string, number>;
  const topTasks = (tasks.data ?? []).sort((a, x) => rank[a.priority] - rank[x.priority]).slice(0, 4);
  const doneCount = (await db().from("tasks").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("status", "done")).count ?? 0;
  const improvements = events.map((e) => ({ ...e, text: EVENT_TEXT[e.kind]?.(e.payload) ?? null })).filter((e) => e.text).slice(0, 8);
  const progressItems = [b.onboarded, input.opps.length + input.invoices.length + input.expenses.length + input.weeks.length > 0, ready > 0, doneCount > 0, events.some((e) => e.kind === "agent_run")];
  const progress = Math.round((progressItems.filter(Boolean).length / progressItems.length) * 100);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-br from-[#0b1530] to-brand-900 p-6 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm text-sky-200">Welcome back</div>
          <h1 className="text-2xl font-semibold tracking-tight">{b.name}</h1>
          <p className="mt-1 text-sm text-slate-300">{b.industry}{b.main_goal ? ` · Goal: ${b.main_goal}` : ""}</p>
        </div>
        <div className="min-w-[14rem]">
          <div className="flex justify-between text-xs text-slate-300"><span>Setup progress</span><span>{progress}%</span></div>
          <div className="mt-1.5 h-2 rounded-full bg-white/15"><div className="h-2 rounded-full bg-sky-400 transition-all" style={{ width: `${progress}%` }} /></div>
          <div className="mt-1.5 text-xs text-slate-400">Profile · data · first AI capability · first action · first agent run</div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div><CardTitle className="flex items-center gap-2"><Gauge className="size-4 text-brand-500" /> What AI can do for you right now</CardTitle><CardDescription>{ready} of {current.length} capabilities verified ready from your records.</CardDescription></div>
            <Button variant="secondary" size="sm" asChild><Link href="/readiness">My AI Readiness <ArrowRight /></Link></Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {current.map((c) => (
              <div key={c.capability} className="flex flex-col gap-1.5 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                <span className="text-sm font-medium">{CAPABILITIES.find((x) => x.key === c.capability)?.label}</span>
                <StatusPill status={c.status} className="w-fit" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="size-4 text-emerald-600" /> Sales findings</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {stale && stale.stale.length > 0 && <Finding href="/sales" title={`${stale.stale.length} open estimates may need follow-up`} value={`${formatMoney(stale.totalValue)} potential pipeline value`} detail={`Top: ${stale.stale.slice(0, 3).map((s) => s.customer).join(", ")}`} />}
            {pipeline && <Finding href="/sales" title={`${pipeline.open.count} open estimates`} value={`${formatMoney(pipeline.open.value)} potential`} detail="Not guaranteed revenue" />}
            {capacity && <Finding href="/sales" title={`${capacity.avgUnusedSlotsPerWeek} unused or cancelled slots per week`} value={`~${formatMoney(capacity.avgWeeklyUnusedValue)} / week`} detail={capacity.limitation} />}
            {!stale && !pipeline && !capacity && <p className="text-slate-500">No sales findings yet. <Link className="text-brand-600 hover:underline" href="/readiness">See what&apos;s needed</Link>.</p>}
            {pipeline && !stale && <p className="text-xs text-amber-700">Missed follow-up detection needs last-contact dates. <Link href="/readiness" className="underline">Fix this</Link></p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Wallet className="size-4 text-amber-600" /> Financial findings</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {overdue && overdue.count > 0 && <Finding href="/finance" title={`${overdue.count} overdue invoices`} value={formatMoney(overdue.total, { cents: true })} detail={`Oldest: ${overdue.overdue[0].customer}, ${overdue.overdue[0].days_overdue} days`} />}
            {overdue && overdue.count === 0 && <p className="text-emerald-700">No overdue invoices.</p>}
            {expenses?.sufficient && <Finding href="/finance" title={`Spending ${expenses.totalChangePct! >= 0 ? "up" : "down"} ${Math.abs(expenses.totalChangePct!)}% vs earlier months`} value={`${expenses.categories[0].category}: ${expenses.categories[0].changePct! > 0 ? "+" : ""}${expenses.categories[0].changePct}%`} detail={`${expenses.priorPeriod} vs ${expenses.recentPeriod}`} />}
            {!overdue && !expenses?.sufficient && <p className="text-slate-500">No financial findings yet. <Link className="text-brand-600 hover:underline" href="/finance">Upload invoices or expenses</Link>.</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between"><CardTitle className="flex items-center gap-2"><ListChecks className="size-4 text-brand-500" /> Top recommended actions</CardTitle><Button variant="link" size="sm" asChild><Link href="/actions">All tasks</Link></Button></div>
          </CardHeader>
          <CardContent>
            {topTasks.length ? (
              <ul className="space-y-2">{topTasks.map((t) => <li key={t.id} className="flex items-center gap-2 rounded-lg bg-slate-50 p-2.5 text-sm"><span className={`size-2 rounded-full ${t.priority === "high" ? "bg-rose-500" : t.priority === "medium" ? "bg-amber-400" : "bg-slate-300"}`} />{t.title}<span className="ml-auto text-xs capitalize text-slate-400">{t.source_agent}</span></li>)}</ul>
            ) : <p className="text-sm text-slate-500">You&apos;re all caught up.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-violet-500" /> Recent improvements</CardTitle></CardHeader>
          <CardContent>
            {improvements.length ? (
              <ul className="space-y-2 text-sm">{improvements.map((e) => <li key={e.id} className="flex gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-violet-400" /><span className="flex-1">{e.text}</span><span className="text-xs text-slate-400">{new Date(e.created_at).toLocaleDateString()}</span></li>)}</ul>
            ) : <p className="text-sm text-slate-500">Improvements appear here as you add data and complete actions.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Finding({ href, title, value, detail }: { href: string; title: string; value: string; detail?: string }) {
  return (
    <Link href={href} className="group block rounded-lg border border-slate-100 p-3 transition hover:border-brand-200 hover:bg-brand-50/30">
      <div className="flex items-start justify-between gap-2"><span className="font-medium">{title}</span><ArrowRight className="size-4 text-slate-300 group-hover:text-brand-500" /></div>
      <div className="mt-0.5 font-semibold text-brand-700">{value}</div>
      {detail && <div className="mt-0.5 text-xs text-slate-500">{detail}</div>}
    </Link>
  );
}
