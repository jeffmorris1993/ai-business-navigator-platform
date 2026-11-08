import Link from "next/link";
import { redirect } from "next/navigation";
import { ownerPage } from "@/lib/page-auth";
import { getBusiness } from "@/lib/db/repo";
import { db } from "@/lib/db/client";
import { liveAiAvailable, aiModel } from "@/lib/ai/openai";
import { Sidebar, MobileNav } from "@/components/app/sidebar";
import { AdvisorDrawer } from "@/components/app/advisor-drawer";
import { DemoGuide } from "@/components/app/demo-guide";
import { SwitchBusiness } from "@/components/app/switch-business";
import { listBusinesses } from "@/lib/db/repo";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { businessId } = await ownerPage();
  const [business, openTasks, businesses] = await Promise.all([
    getBusiness(businessId),
    db().from("tasks").select("id", { count: "exact", head: true }).eq("business_id", businessId).in("status", ["open", "in_progress"]),
    listBusinesses(),
  ]);
  if (!business.onboarded) redirect("/onboarding");
  const live = liveAiAvailable();
  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-[#0b1530] px-4 py-5 lg:flex">
        <Link href="/home" className="mb-6 flex items-center gap-2.5 px-2">
          <div className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-sky-400 to-brand-600 text-sm font-bold text-white">S</div>
          <div>
            <div className="text-sm font-semibold leading-tight text-white">Sirrom Navigator</div>
            <div className="text-[11px] leading-tight text-slate-400">Business AI platform</div>
          </div>
        </Link>
        <Sidebar openTasks={openTasks.count ?? 0} />
        <div className="mt-auto rounded-lg bg-white/5 p-3 text-[11px] leading-relaxed text-slate-400">
          {business.is_sample && <div className="mb-1 font-medium text-amber-300">Sample Data Mode</div>}
          All businesses and records here are fictional sample data.
        </div>
      </aside>
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/85 px-4 backdrop-blur lg:px-8">
        <SwitchBusiness current={{ id: business.id, name: business.name }} businesses={businesses.map((b) => ({ id: b.id, name: b.name, industry: b.industry }))} />
        <div className="ml-auto flex items-center gap-2">
          {business.is_sample && <span className="hidden rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200 sm:inline">Sample Data</span>}
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${live ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-slate-200"}`} title={live ? `Model: ${aiModel()}` : "No OpenAI API key configured"}>
            {live ? `Live AI: on` : "Live AI: unavailable"}
          </span>
        </div>
      </header>
      <MobileNav />
      <main className="mx-auto max-w-6xl px-4 py-8 lg:px-8">{children}</main>
      <AdvisorDrawer liveAi={live} />
      <DemoGuide />
    </div>
  );
}
