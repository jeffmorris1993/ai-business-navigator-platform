import Link from "next/link";
import { ArrowRight, Building2, ShieldCheck, Cpu, Brain, UserCheck } from "lucide-react";
import { listBusinesses } from "@/lib/db/repo";
import { db } from "@/lib/db/client";
import { SignInButton } from "@/components/app/signin-button";
import { PresetGrid } from "@/components/app/preset-grid";
import { Wordmark } from "@/components/brand/mark";
import { AgentGlyph, AGENT_META } from "@/components/app/status";
import { liveAiAvailable, aiModel } from "@/lib/ai/openai";

export const dynamic = "force-dynamic";

/** Illustrative schematic of how a scan is coordinated. Shows structure only: no numbers or results. */
function CoordinationSchematic() {
  const stages = ["Verify", "Orient", "Dispatch", "Investigate", "Prioritize", "Brief"];
  const lanes = [
    { a: "readiness", t: "Checks which capabilities your records support" },
    { a: "sales", t: "Looks for stalled quotes and missed follow-ups" },
    { a: "finance", t: "Traces overdue balances and rising costs" },
  ];
  return (
    <div className="relative rounded-panel border border-midnight-line bg-midnight-2/70 p-5 sm:p-6" aria-label="How an intelligence scan is coordinated (illustration)">
      <ol className="flex flex-wrap items-center gap-1">
        {stages.map((s, i) => (
          <li key={s} className="flex items-center gap-1">
            {i > 0 && <span className="h-px w-3 bg-midnight-line sm:w-5" />}
            <span className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] ${i === 3 ? "bg-lime text-midnight" : "text-night-2"}`}><span className={`size-1.5 rounded-full ${i === 3 ? "bg-midnight" : i < 3 ? "bg-lime" : "bg-midnight-line"}`} />{s}</span>
          </li>
        ))}
      </ol>
      <div className="mt-6 flex items-center gap-3 rounded-xl border border-midnight-line bg-midnight p-3.5">
        <AgentGlyph agent="orchestrator" size={34} onDark />
        <div>
          <div className="text-[14px] font-medium text-white">Intelligence Engine</div>
          <div className="text-[12.5px] text-night-2">Reviews the records and decides which specialists to send</div>
        </div>
      </div>
      <div className="relative mx-auto hidden h-6 sm:block" style={{ width: "66.6%" }} aria-hidden="true">
        <span className="absolute left-1/2 top-0 h-3 w-px bg-midnight-line" />
        <span className="absolute inset-x-0 top-3 h-px bg-midnight-line" />
        {[0, 50, 100].map((x) => <span key={x} className="connector-flow absolute top-3 h-3 w-[2px] -translate-x-1/2" style={{ left: `${x}%` }} />)}
      </div>
      <div className="mt-3 grid gap-2.5 sm:mt-0 sm:grid-cols-3">
        {lanes.map((l) => (
          <div key={l.a} className="rounded-xl border border-midnight-line bg-midnight/60 p-3">
            <div className="flex items-center gap-2"><AgentGlyph agent={l.a} size={22} onDark /><span className="text-[12.5px] font-medium text-white">{AGENT_META[l.a].label}</span></div>
            <p className="mt-2 text-[12px] leading-snug text-night-2">{l.t}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-lg bg-lime/[0.08] px-3 py-2 text-[12.5px] text-night ring-1 ring-lime/25">
        <span className="size-2 rounded-sm bg-lime" /> Findings are saved with evidence. Drafts wait for the owner. Nothing is sent.
      </div>
    </div>
  );
}

export default async function Landing() {
  const [businesses, sponsors] = await Promise.all([listBusinesses(), db().from("sponsors").select("slug,name,program_name").order("created_at")]);
  const live = liveAiAvailable();
  const metro = businesses.find((b) => b.slug === "metro-roofing");
  return (
    <div className="min-h-screen bg-canvas">
      <div className="on-dark relative overflow-hidden bg-midnight text-night">
        <div className="pointer-events-none absolute -right-40 -top-40 size-[560px] rounded-full border border-white/[0.04]" />
        <div className="pointer-events-none absolute -right-20 -top-20 size-[360px] rounded-full border border-white/[0.05]" />
        <header className="relative mx-auto flex max-w-6xl items-center gap-3 px-5 py-5 sm:px-6">
          <Wordmark tone="light" size="sm" />
          <span className="ml-auto flex items-center gap-1.5 text-[12px] text-night-3"><span className={`size-1.5 rounded-full ${live ? "bg-lime" : "bg-night-3"}`} />{live ? <>AI live <span className="hidden font-mono text-[11px] sm:inline">{aiModel()}</span></> : "AI unavailable"}</span>
        </header>

        <section className="relative mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-10 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pt-16">
          <div className="animate-fade-up">
            <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.18em] text-night-3"><span>Sirrom Studios</span><span className="h-px w-8 bg-midnight-line" /><span>Business AI Navigator</span></div>
            <h1 className="mt-5 font-display text-[40px] leading-[1.04] tracking-[-0.025em] text-white sm:text-[56px]">AI agents that investigate your business <span className="text-lime">and prepare the work.</span></h1>
            <p className="mt-6 max-w-xl text-[16.5px] leading-[1.65] text-night-2">Sirrom reviews a small business&apos;s own records, finds what needs attention in sales and finances, drafts the follow-ups, and waits for the owner&apos;s approval. Every number comes from the records; every action is visible.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {metro && (
                <SignInButton businessId={metro.id} className="inline-flex h-11 items-center gap-2 rounded-[9px] bg-lime px-5 text-[14.5px] font-medium text-midnight hover:bg-lime-dim">
                  <span className="flex items-center gap-2">Open the Metro Roofing demo <ArrowRight className="size-4" /></span>
                </SignInButton>
              )}
              <Link href="/start" className="inline-flex h-11 items-center gap-2 rounded-[9px] px-5 text-[14.5px] font-medium text-white ring-1 ring-midnight-line hover:bg-white/5">Onboard an example company</Link>
            </div>
          </div>
          <CoordinationSchematic />
        </section>
      </div>

      <section className="border-b border-line">
        <ol className="mx-auto grid max-w-6xl gap-px px-5 sm:px-6 md:grid-cols-3">
          {[
            { Icon: Cpu, t: "Software reads and checks the records", d: "Pipeline values, overdue balances, contact gaps and readiness are calculated exactly. These numbers are never guessed by AI." },
            { Icon: Brain, t: "AI agents decide what to investigate", d: "A coordinator dispatches Readiness, Sales and Financial agents, which choose their own tools, dig deeper and record findings with evidence." },
            { Icon: UserCheck, t: "The owner reviews prepared work", d: "Follow-ups, payment reminders and tasks wait for approval. When records change, software re-verifies every finding." },
          ].map(({ Icon, t, d }, i) => (
            <li key={t} className="border-line py-9 md:border-r md:px-8 md:first:pl-0 md:last:border-r-0 md:last:pr-0">
              <div className="flex items-center gap-3"><span className="tnum font-mono text-[12px] text-ink-4">0{i + 1}</span><Icon className="size-4 text-ink-3" /></div>
              <h2 className="mt-3 font-display text-[21px] leading-snug text-ink">{t}</h2>
              <p className="mt-2 text-[14.5px] leading-relaxed text-ink-3">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-6 lg:grid-cols-[2fr_1fr]">
        <div>
          <div className="mb-8 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-[32px] leading-tight tracking-[-0.015em] text-ink">Example companies</h2>
              <p className="mt-2 text-[14.5px] text-ink-3">Onboard any of them from scratch, or open one with its records already loaded. All fictional.</p>
            </div>
            <Link href="/start" className="shrink-0 text-[13.5px] font-medium text-cobalt hover:text-cobalt-700">All details →</Link>
          </div>
          <PresetGrid compact />
          <div className="mt-5 text-[13px] text-ink-3">Prefer the original readiness walkthrough? <Link href="/demo" className="text-cobalt hover:underline">Start Metro Roofing from scratch</Link>.</div>
        </div>
        <aside>
          <h2 className="font-display text-[24px] text-ink">Sponsor view</h2>
          <p className="mt-2 text-[14px] text-ink-3">Program-level adoption and outcomes. Counts only.</p>
          <div className="mt-5 space-y-2.5">
            {(sponsors.data ?? []).map((s) => (
              <SignInButton key={s.slug} sponsorSlug={s.slug} className="flex w-full items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3.5 text-left shadow-card transition hover:border-line-strong">
                <span className="flex gap-3"><Building2 className="mt-0.5 size-4 text-ink-3" /><span><span className="block text-[14px] font-medium">{s.program_name}</span><span className="block text-[12.5px] text-ink-3">{s.name}</span></span></span>
              </SignInButton>
            ))}
          </div>
          <p className="mt-5 flex gap-2 text-[12.5px] leading-relaxed text-ink-3"><ShieldCheck className="size-4 shrink-0" />Sponsor names are fictional. No real company has approved, funded or endorsed this prototype.</p>
        </aside>
      </section>
    </div>
  );
}
