import Link from "next/link";
import { Building2, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db/client";
import { SignInButton } from "@/components/app/signin-button";

export const dynamic = "force-dynamic";

export default async function SponsorAccess() {
  const sponsors = (await db().from("sponsors").select("slug,name,program_name").order("created_at")).data ?? [];
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <Building2 className="size-6 text-brand-600" />
        <h1 className="mt-3 text-xl font-semibold">Sponsor Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Sponsors sign in separately and see program-level counts only. Business owners&apos; customer, invoice and financial records are never shown to sponsors.</p>
        <div className="mt-6 space-y-3">
          {sponsors.map((s) => (
            <SignInButton key={s.slug} sponsorSlug={s.slug} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-4 text-left hover:border-brand-300 hover:bg-brand-50/40">
              <div><div className="font-medium">Sign in as {s.program_name}</div><div className="text-sm text-slate-500">{s.name}</div></div>
            </SignInButton>
          ))}
        </div>
        <div className="mt-6 flex gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600"><ShieldCheck className="size-4 shrink-0" /> Fictional sponsors. No real organization has approved, funded or endorsed this product.</div>
        <Link href="/home" className="mt-4 block text-center text-sm text-slate-500 hover:text-slate-700">Back to business view</Link>
      </div>
    </div>
  );
}
