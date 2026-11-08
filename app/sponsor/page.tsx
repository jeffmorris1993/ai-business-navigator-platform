import Link from "next/link";
import { sponsorPage } from "@/lib/page-auth";
import { sponsorMetrics } from "@/lib/services/sponsor";
import { Stat, StatStrip } from "@/components/app/status";
import { SectionHeader } from "@/components/ui/card";
import { SponsorWeeklyChart, ReadyBeforeAfter } from "@/components/app/charts";
import { SponsorSignOut } from "@/components/app/sponsor-signout";
import { PresentationGuide } from "@/components/app/demo-guide";
import { ShieldCheck, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SponsorDashboard({ searchParams }: { searchParams: Promise<{ sim?: string }> }) {
  const { sponsorId } = await sponsorPage();
  const sp = await searchParams;
  const includeSim = sp.sim !== "0";
  const m = await sponsorMetrics(sponsorId, includeSim);
  const t = m.totals;
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-[#fbfbfa]">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-3">
          <span className="grid size-8 place-items-center rounded-md bg-ink text-white"><Building2 className="size-4" /></span>
          <div className="min-w-0">
            <div className="truncate text-[13.5px] font-semibold">{m.sponsor.program_name}</div>
            <div className="truncate text-xs text-ink-3">{m.sponsor.name} · powered by Sirrom Business AI Navigator</div>
          </div>
          <div className="ml-auto"><SponsorSignOut /></div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-9 px-6 py-8">
        <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight">Program impact</h1>
            <p className="mt-1 max-w-2xl text-[13.5px] text-ink-3">How participating small businesses move from a first readiness check to AI agents investigating their records and preparing work.</p>
          </div>
          <div className="flex rounded-md border border-line bg-surface p-0.5 text-xs shadow-card">
            <Link href="/sponsor?sim=1" className={cn("rounded px-2.5 py-1", includeSim ? "bg-ink text-white" : "text-ink-3")}>Include simulated cohort ({m.simulatedCount})</Link>
            <Link href="/sponsor?sim=0" className={cn("rounded px-2.5 py-1", !includeSim ? "bg-ink text-white" : "text-ink-3")}>Live demo businesses only</Link>
          </div>
        </div>
        <div className="flex items-start gap-2 text-[13px] text-ink-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal" /><span>{m.privacy}{includeSim && m.simulatedCount > 0 && <span className="text-amber-700"> Figures include {m.simulatedCount} simulated, fictional cohort businesses to illustrate program scale; AI work figures come only from businesses actually used in this app.</span>}</span></div>

        <section>
          <SectionHeader title="Adoption and readiness" />
          <StatStrip>
            <Stat label="Businesses enrolled" value={t.enrolled} sub={`${t.onboarded} completed onboarding`} />
            <Stat label="Readiness assessed" value={t.assessed} sub={`${t.improvedReadiness} improved since first check`} />
            <Stat label="AI capabilities activated" value={t.capabilitiesActivated} sub={`Avg ready per business: ${t.avgReadyAtStart} → ${t.avgReadyNow}`} tone="green" />
            <Stat label="Recommended actions completed" value={<>{t.tasksDone}<span className="text-base font-normal text-ink-4"> / {t.tasksTotal}</span></>} sub={`${t.taskCompletionRate}% completion`} />
          </StatStrip>
        </section>

        <section>
          <SectionHeader title="AI work and outcomes" description="Kept separate on purpose: what AI prepared is not the same as what owners approved, and neither is a verified result." />
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line shadow-card md:grid-cols-5 [&>*]:rounded-none [&>*]:border-0 [&>*]:shadow-none">
            <Stat label="Businesses scanned by AI" value={m.ai.businessesScanned} sub={`${m.ai.scansCompleted} intelligence scans`} />
            <Stat label="Findings surfaced" value={m.ai.findingsSurfaced} sub="Issues and opportunities, with evidence" tone="brand" />
            <Stat label="AI-prepared actions" value={m.ai.aiPreparedActions} sub="Drafts and tasks prepared by agents" />
            <Stat label="Owner-approved actions" value={m.ai.ownerApprovedActions} sub="Approved by a person" />
            <Stat label="Software-verified outcomes" value={m.ai.verifiedOutcomes} sub="e.g. invoice now paid, estimate contacted" tone="green" />
          </div>
        </section>

        <div className="grid gap-9 lg:grid-cols-[3fr_2fr]">
          <section>
            <SectionHeader title="From readiness to active AI use" />
            <div className="space-y-3 rounded-lg border border-line bg-surface p-5 shadow-card">
              {m.funnel.map((f) => (
                <div key={f.stage}>
                  <div className="mb-1 flex justify-between text-[13px]"><span>{f.stage}</span><span className="tnum font-medium">{f.count} <span className="font-normal text-ink-4">{f.pct}%</span></span></div>
                  <div className="h-1.5 rounded-full bg-subtle"><div className="h-1.5 rounded-full bg-cobalt" style={{ width: `${f.pct}%` }} /></div>
                </div>
              ))}
            </div>
          </section>
          <section>
            <SectionHeader title="Capabilities ready per business" description="Average at first check vs. today" />
            <div className="rounded-lg border border-line bg-surface p-4 shadow-card"><ReadyBeforeAfter before={t.avgReadyAtStart} after={t.avgReadyNow} /></div>
          </section>
        </div>

        <section>
          <SectionHeader title="Progress over time" description="Weekly counts. Improvements are verified by readiness checks on each business's own records." />
          <div className="rounded-lg border border-line bg-surface p-4 shadow-card"><SponsorWeeklyChart data={m.weekly} /></div>
        </section>

        <section>
          <SectionHeader title="Participating industries" description="Groups smaller than 3 are combined to protect privacy." />
          <div className="flex flex-wrap gap-2">{m.industryBreakdown.map((i) => <span key={i.industry} className="rounded-md border border-line bg-surface px-2.5 py-1 text-[13px] shadow-card">{i.industry} <b className="tnum">{i.count}</b></span>)}</div>
        </section>

        <p className="border-t border-line pt-5 text-center text-xs text-ink-4">Fictional sponsor and sample data. No real organization has approved, funded or endorsed this product. The same platform can be licensed to multiple sponsors, each seeing only its own program.</p>
      </main>
      <PresentationGuide />
    </div>
  );
}
