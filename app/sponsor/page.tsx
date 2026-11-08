import Link from "next/link";
import { sponsorPage } from "@/lib/page-auth";
import { sponsorMetrics } from "@/lib/services/sponsor";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Stat } from "@/components/app/status";
import { SponsorWeeklyChart, ReadyBeforeAfter } from "@/components/app/charts";
import { SponsorSignOut } from "@/components/app/sponsor-signout";
import { DemoGuide } from "@/components/app/demo-guide";
import { ShieldCheck, Building2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SponsorDashboard({ searchParams }: { searchParams: Promise<{ sim?: string }> }) {
  const { sponsorId } = await sponsorPage();
  const sp = await searchParams;
  const includeSim = sp.sim !== "0";
  const m = await sponsorMetrics(sponsorId, includeSim);
  const t = m.totals;
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4">
          <div className="grid size-9 place-items-center rounded-lg text-white" style={{ background: m.sponsor.accent_color }}><Building2 className="size-5" /></div>
          <div>
            <div className="font-semibold">{m.sponsor.program_name}</div>
            <div className="text-xs text-slate-500">{m.sponsor.name} · Powered by Sirrom Business AI Navigator</div>
          </div>
          <div className="ml-auto"><SponsorSignOut /></div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 sm:flex-row sm:items-center">
          <ShieldCheck className="size-5 shrink-0" />
          <span className="flex-1">{m.privacy}</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Program impact</h1>
            <p className="text-sm text-slate-500">How participating small businesses move from first readiness check to active AI use.</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Link href="/sponsor?sim=1" className={`rounded-md px-3 py-1.5 ${includeSim ? "bg-brand-600 text-white" : "bg-white ring-1 ring-slate-200"}`}>Include simulated cohort ({m.simulatedCount})</Link>
            <Link href="/sponsor?sim=0" className={`rounded-md px-3 py-1.5 ${!includeSim ? "bg-brand-600 text-white" : "bg-white ring-1 ring-slate-200"}`}>Live demo businesses only</Link>
          </div>
        </div>
        {includeSim && m.simulatedCount > 0 && <p className="-mt-3 text-xs text-amber-700">Includes {m.simulatedCount} simulated, fictional cohort businesses generated to illustrate program scale. Switch to &quot;Live demo businesses only&quot; to see figures from businesses actually used in this app.</p>}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Businesses enrolled" value={t.enrolled} sub={`${t.onboarded} completed onboarding`} />
          <Stat label="Readiness assessed" value={t.assessed} sub={`${t.improvedReadiness} improved since first check`} tone="brand" />
          <Stat label="AI capabilities activated" value={t.capabilitiesActivated} sub={`Avg ready: ${t.avgReadyAtStart} → ${t.avgReadyNow} per business`} tone="green" />
          <Stat label="Recommended actions completed" value={`${t.tasksDone} / ${t.tasksTotal}`} sub={`${t.taskCompletionRate}% completion`} tone="amber" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Sales Agent adoption" value={t.salesAgentAdoption} sub={`${t.enrolled ? Math.round((t.salesAgentAdoption / t.enrolled) * 100) : 0}% of enrolled businesses`} />
          <Stat label="Financial Agent adoption" value={t.financeAgentAdoption} sub={`${t.enrolled ? Math.round((t.financeAgentAdoption / t.enrolled) * 100) : 0}% of enrolled businesses`} />
          <Stat label="Data quality improvements" value={t.qualityImprovements} sub="Capability status upgrades verified by readiness checks" />
        </div>

        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          <Card>
            <CardHeader><CardTitle>From readiness to active AI use</CardTitle><CardDescription>Share of enrolled businesses reaching each stage.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {m.funnel.map((f) => (
                <div key={f.stage}>
                  <div className="mb-1 flex justify-between text-sm"><span>{f.stage}</span><span className="font-medium">{f.count} <span className="text-slate-400">({f.pct}%)</span></span></div>
                  <div className="h-3 rounded-full bg-slate-100"><div className="h-3 rounded-full transition-all" style={{ width: `${f.pct}%`, background: m.sponsor.accent_color }} /></div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Capabilities ready per business</CardTitle><CardDescription>Average at first readiness check vs today.</CardDescription></CardHeader>
            <CardContent><ReadyBeforeAfter before={t.avgReadyAtStart} after={t.avgReadyNow} /></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Progress over time</CardTitle><CardDescription>Weekly counts. Verified improvements come from readiness checks run on each business&apos;s own records.</CardDescription></CardHeader>
          <CardContent><SponsorWeeklyChart data={m.weekly} /></CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Participating industries</CardTitle><CardDescription>Groups smaller than 3 are combined to protect privacy.</CardDescription></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">{m.industryBreakdown.map((i) => <span key={i.industry} className="rounded-full bg-slate-100 px-3 py-1 text-sm">{i.industry} <b>{i.count}</b></span>)}</div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400">Fictional sponsor and sample data. No real organization has approved, funded or endorsed this product. The same platform can be licensed to multiple sponsors, each seeing only its own program.</p>
      </main>
      <DemoGuide />
    </div>
  );
}
