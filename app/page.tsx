import Link from "next/link";
import { ArrowRight, Gauge, TrendingUp, Wallet, Building2, ShieldCheck, Compass } from "lucide-react";
import { listBusinesses } from "@/lib/db/repo";
import { db } from "@/lib/db/client";
import { SignInButton } from "@/components/app/signin-button";
import { liveAiAvailable } from "@/lib/ai/openai";

export const dynamic = "force-dynamic";

export default async function Landing() {
  const [businesses, sponsors] = await Promise.all([listBusinesses(), db().from("sponsors").select("slug,name,program_name").order("created_at")]);
  const live = liveAiAvailable();
  return (
    <div className="min-h-screen">
      <div className="bg-[#0b1530] text-white">
        <div className="mx-auto max-w-6xl px-6 pb-16 pt-8">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-sky-400 to-brand-600 text-sm font-bold">S</div>
            <span className="font-semibold">Sirrom Business AI Navigator</span>
            <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-slate-300">by Sirrom Studios</span>
            <span className={`ml-auto rounded-full px-2.5 py-1 text-xs ${live ? "bg-emerald-400/15 text-emerald-300" : "bg-white/10 text-slate-300"}`}>{live ? "Live AI: on" : "Live AI: unavailable"}</span>
          </div>
          <div className="mt-14 max-w-3xl animate-fade-in">
            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Tell us about your business. We&apos;ll help you put AI to work.</h1>
            <p className="mt-4 text-lg text-slate-300">Understand where AI can help, get your information ready, and turn your own records into sales and financial results you can measure.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/demo" className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-5 py-3 font-medium hover:bg-sky-400"><Compass className="size-4" /> Start the 5-minute demo</Link>
              <Link href="/start" className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-5 py-3 font-medium hover:bg-white/15">Set up a new business <ArrowRight className="size-4" /></Link>
            </div>
          </div>
          <div className="mt-14 grid gap-4 sm:grid-cols-3">
            {[
              { Icon: Gauge, t: "AI Readiness Agent", d: "Checks your real records, capability by capability, and helps you fix what's missing." },
              { Icon: TrendingUp, t: "Sales Intelligence Agent", d: "Finds open estimates that need follow-up and drafts the messages for your approval." },
              { Icon: Wallet, t: "Financial Intelligence Agent", d: "Finds overdue invoices, rising costs and cash gaps, with exact calculations." },
            ].map(({ Icon, t, d }) => (
              <div key={t} className="rounded-xl bg-white/5 p-5 ring-1 ring-white/10">
                <Icon className="size-5 text-sky-300" />
                <div className="mt-3 font-semibold">{t}</div>
                <p className="mt-1 text-sm text-slate-400">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[2fr_1fr]">
        <div>
          <h2 className="text-lg font-semibold">Explore a sample business</h2>
          <p className="mt-1 text-sm text-slate-500">Fictional businesses with fictional records. Every number is calculated live from their data.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {businesses.map((b) => (
              <SignInButton key={b.id} businessId={b.id} className="group rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-brand-300 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{b.name}</span>
                  <ArrowRight className="size-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
                </div>
                <div className="mt-0.5 text-sm text-slate-500">{b.industry ?? "Starts at onboarding"} · {b.data_path === "manual" ? "Paper records" : "Spreadsheets"}</div>
              </SignInButton>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold">Sponsor view</h2>
          <p className="mt-1 text-sm text-slate-500">How a sponsoring organization sees program adoption. Aggregate counts only.</p>
          <div className="mt-4 space-y-3">
            {(sponsors.data ?? []).map((s) => (
              <SignInButton key={s.slug} sponsorSlug={s.slug} className="flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-brand-300 hover:shadow-md">
                <Building2 className="mt-0.5 size-5 text-slate-400" />
                <div>
                  <div className="font-medium">{s.program_name}</div>
                  <div className="text-sm text-slate-500">{s.name}</div>
                </div>
              </SignInButton>
            ))}
          </div>
          <div className="mt-4 flex gap-2 rounded-xl bg-slate-100 p-3 text-xs text-slate-600">
            <ShieldCheck className="size-4 shrink-0" />
            Sponsor names are fictional. No real company has approved, funded or endorsed this prototype.
          </div>
        </div>
      </div>
    </div>
  );
}
