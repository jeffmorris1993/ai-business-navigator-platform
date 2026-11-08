import Link from "next/link";
import { Building2, ShieldCheck, ArrowRight } from "lucide-react";
import { db } from "@/lib/db/client";
import { SignInButton } from "@/components/app/signin-button";
import { PublicHeader } from "@/components/brand/public-header";

export const dynamic = "force-dynamic";

export default async function SponsorAccess() {
  const sponsors = (await db().from("sponsors").select("slug,name,program_name").order("created_at")).data ?? [];
  return (
    <div className="min-h-screen bg-canvas">
      <PublicHeader />
      <main className="mx-auto max-w-xl px-4 py-14 sm:py-20">
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-4">Program view</div>
        <h1 className="mt-3 font-display text-[38px] leading-tight tracking-[-0.02em]">Sponsor Dashboard</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-3">Sponsors sign in separately and see program-level counts only. Business owners&apos; customer, invoice and financial records are never shown to sponsors.</p>
        <div className="mt-8 space-y-3">
          {sponsors.map((s) => (
            <SignInButton key={s.slug} sponsorSlug={s.slug} className="group flex w-full items-center gap-4 rounded-panel border border-line bg-surface p-5 text-left shadow-card transition hover:border-line-strong">
              <span className="flex w-full items-center gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-[9px] bg-midnight text-lime"><Building2 className="size-5" /></span>
                <span className="min-w-0 flex-1"><span className="block text-[15px] font-medium">Sign in as {s.program_name}</span><span className="block text-[13px] text-ink-3">{s.name}</span></span>
                <ArrowRight className="size-4 text-ink-4 transition group-hover:translate-x-0.5" />
              </span>
            </SignInButton>
          ))}
        </div>
        <p className="mt-6 flex gap-2 text-[12.5px] leading-relaxed text-ink-3"><ShieldCheck className="size-4 shrink-0" /> Fictional sponsors. No real organization has approved, funded or endorsed this product.</p>
        <Link href="/overview" className="mt-6 inline-block text-[13.5px] text-ink-3 hover:text-ink">← Back to business view</Link>
      </main>
    </div>
  );
}
