import Link from "next/link";
import { ArrowRight, Building2, ShieldCheck, Brain, Cpu, UserCheck } from "lucide-react";
import { listBusinesses } from "@/lib/db/repo";
import { db } from "@/lib/db/client";
import { SignInButton } from "@/components/app/signin-button";
import { liveAiAvailable, aiModel } from "@/lib/ai/openai";

export const dynamic = "force-dynamic";

export default async function Landing() {
  const [businesses, sponsors] = await Promise.all([listBusinesses(), db().from("sponsors").select("slug,name,program_name").order("created_at")]);
  const live = liveAiAvailable();
  const metro = businesses.find((b) => b.slug === "metro-roofing");
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-[#fbfbfa]">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-3">
          <span className="relative grid size-7 place-items-center rounded-md bg-ink text-[13px] font-semibold text-white">S<span className="absolute -right-0.5 -top-0.5 size-2 rounded-full border-2 border-[#fbfbfa] bg-cobalt" /></span>
          <span className="text-[13.5px] font-semibold tracking-tight">Sirrom <span className="font-normal text-ink-3">Business AI Navigator</span></span>
          <span className="ml-auto flex items-center gap-1.5 text-xs text-ink-3"><span className={`size-1.5 rounded-full ${live ? "bg-teal" : "bg-ink-4"}`} />{live ? <>AI live <span className="font-mono text-[11px] text-ink-4">{aiModel()}</span></> : "AI unavailable"}</span>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-12 px-6 pb-14 pt-16 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div className="animate-fade-in">
          <div className="text-xs font-medium uppercase tracking-[0.1em] text-cobalt">by Sirrom Studios</div>
          <h1 className="mt-3 text-[40px] font-semibold leading-[1.08] tracking-tight text-ink sm:text-[46px]">AI agents that investigate your business and prepare the work.</h1>
          <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-ink-3">Sirrom reviews a small business&apos;s own records, finds what needs attention in sales and finances, drafts the follow-ups, and waits for the owner&apos;s approval. Every number comes from the records; every action is visible.</p>
          <div className="mt-7 flex flex-wrap gap-2.5">
            {metro && (
              <SignInButton businessId={metro.id} className="inline-flex h-10 items-center gap-2 rounded-md bg-cobalt px-4 text-sm font-medium text-white hover:bg-cobalt-700">
                <span className="flex items-center gap-2">Open the Metro Roofing demo <ArrowRight className="size-4" /></span>
              </SignInButton>
            )}
            <Link href="/start" className="inline-flex h-10 items-center gap-2 rounded-md border border-line-strong bg-surface px-4 text-sm font-medium text-ink shadow-card hover:bg-subtle">Set up a new business</Link>
          </div>
        </div>
        <div className="rounded-lg border border-line bg-surface p-5 shadow-card">
          <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-4">How an intelligence scan works</div>
          <ol className="space-y-4">
            {[
              { Icon: Cpu, t: "Software reads and checks the records", d: "Pipeline values, overdue balances, contact gaps and readiness are calculated exactly. These numbers are never guessed by AI.", c: "bg-subtle text-ink-2" },
              { Icon: Brain, t: "AI agents decide what to investigate", d: "A coordinator dispatches Readiness, Sales and Financial agents, which choose their own tools, dig deeper and record findings with evidence.", c: "bg-cobalt-50 text-cobalt" },
              { Icon: UserCheck, t: "The owner reviews prepared work", d: "Follow-ups, payment reminders and tasks wait for approval. When records change, software re-verifies every finding.", c: "bg-teal-50 text-teal-700" },
            ].map(({ Icon, t, d, c }, i) => (
              <li key={t} className="flex gap-3">
                <span className={`grid size-7 shrink-0 place-items-center rounded-md ${c}`}><Icon className="size-3.5" /></span>
                <div><div className="text-[13.5px] font-medium"><span className="tnum mr-1.5 text-ink-4">{i + 1}</span>{t}</div><p className="mt-0.5 text-[13px] leading-relaxed text-ink-3">{d}</p></div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-line bg-[#fbfbfa]">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 lg:grid-cols-[2fr_1fr]">
          <div>
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-3">Sample businesses</h2>
            <p className="mt-0.5 text-[13px] text-ink-3">Fictional businesses with fictional records. Everything is calculated live from their data.</p>
            <div className="mt-4 grid gap-px overflow-hidden rounded-lg border border-line bg-line shadow-card sm:grid-cols-2">
              {businesses.map((b) => (
                <SignInButton key={b.id} businessId={b.id} className="group flex items-center gap-3 bg-surface px-4 py-3.5 text-left hover:bg-subtle/60">
                  <span className="flex w-full items-center gap-3">
                    <span className="grid size-8 place-items-center rounded-md bg-subtle text-[13px] font-semibold text-ink-2 ring-1 ring-line">{b.name.slice(0, 1)}</span>
                    <span className="min-w-0 flex-1"><span className="block text-[13.5px] font-medium">{b.name}</span><span className="block truncate text-xs text-ink-3">{b.industry ?? "Starts at onboarding"} · {b.data_path === "manual" ? "Paper records" : "Spreadsheets"}</span></span>
                    <ArrowRight className="size-4 text-ink-4 transition group-hover:translate-x-0.5 group-hover:text-ink-2" />
                  </span>
                </SignInButton>
              ))}
            </div>
            <div className="mt-3 text-[12.5px] text-ink-3">Prefer the original readiness walkthrough? <Link href="/demo" className="text-cobalt hover:underline">Start Metro Roofing from scratch</Link>.</div>
          </div>
          <div>
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-3">Sponsor view</h2>
            <p className="mt-0.5 text-[13px] text-ink-3">Program-level adoption and outcomes. Counts only.</p>
            <div className="mt-4 space-y-2">
              {(sponsors.data ?? []).map((s) => (
                <SignInButton key={s.slug} sponsorSlug={s.slug} className="flex w-full items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-left shadow-card hover:bg-subtle/60">
                  <span className="flex gap-3"><Building2 className="mt-0.5 size-4 text-ink-3" /><span><span className="block text-[13.5px] font-medium">{s.program_name}</span><span className="block text-xs text-ink-3">{s.name}</span></span></span>
                </SignInButton>
              ))}
            </div>
            <p className="mt-4 flex gap-2 text-[12px] leading-relaxed text-ink-3"><ShieldCheck className="size-4 shrink-0" />Sponsor names are fictional. No real company has approved, funded or endorsed this prototype.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
