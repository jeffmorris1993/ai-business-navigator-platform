import { redirect } from "next/navigation";
import { ownerPage } from "@/lib/page-auth";
import { getBusiness, listBusinesses } from "@/lib/db/repo";
import { db } from "@/lib/db/client";
import { liveAiAvailable, aiModel } from "@/lib/ai/openai";
import { Sidebar, MobileNav } from "@/components/app/sidebar";
import { AdvisorDrawer } from "@/components/app/advisor-drawer";
import { PresentationGuide } from "@/components/app/demo-guide";
import { SwitchBusiness } from "@/components/app/switch-business";
import { DemoModeButton } from "@/components/app/demo-mode";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { businessId } = await ownerPage();
  const [business, openTasks, drafts, pending, findings, businesses] = await Promise.all([
    getBusiness(businessId),
    db().from("tasks").select("id", { count: "exact", head: true }).eq("business_id", businessId).in("status", ["open", "in_progress"]),
    db().from("drafts").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("status", "draft"),
    db().from("pending_actions").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("status", "pending"),
    db().from("findings").select("id", { count: "exact", head: true }).eq("business_id", businessId).in("status", ["new", "needs_review", "action_prepared", "in_progress"]),
    listBusinesses(),
  ]);
  if (!business.onboarded) redirect("/onboarding");
  const live = liveAiAvailable();
  const counts = { findings: findings.count ?? 0, actions: (openTasks.count ?? 0) + (drafts.count ?? 0) + (pending.count ?? 0) };
  return (
    <div className="min-h-screen lg:pl-60">
      <Sidebar
        counts={counts}
        footer={
          <div className="rounded-md border border-line bg-surface px-3 py-2.5 text-[11.5px] leading-relaxed text-ink-3">
            <div className="mb-0.5 flex items-center gap-1.5 font-medium text-ink-2"><span className="size-1.5 rounded-full bg-amber" /> Sample data</div>
            Fictional businesses and records for demonstration.
          </div>
        }
      />
      <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b border-line bg-canvas/90 px-3 backdrop-blur sm:px-6">
        <MobileNav counts={counts} />
        <SwitchBusiness current={{ id: business.id, name: business.name, industry: business.industry }} businesses={businesses.map((b) => ({ id: b.id, name: b.name, industry: b.industry }))} />
        <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
          {business.is_sample && <span className="hidden items-center gap-1.5 text-xs text-ink-3 md:inline-flex"><span className="size-1.5 rounded-full bg-amber" />Sample data</span>}
          <span className="hidden items-center gap-1.5 text-xs text-ink-3 sm:inline-flex" title={live ? `Live model: ${aiModel()}` : "No OpenAI API key configured"}>
            <span className={`size-1.5 rounded-full ${live ? "bg-teal" : "bg-ink-4"}`} />
            {live ? <>AI live <span className="font-mono text-[11px] text-ink-4">{aiModel()}</span></> : "AI unavailable"}
          </span>
          {business.is_sample && business.slug && <DemoModeButton slug={business.slug} liveAi={live} />}
        </div>
      </header>
      <main className="mx-auto max-w-[1180px] px-4 py-7 sm:px-6 lg:px-8">{children}</main>
      <AdvisorDrawer liveAi={live} />
      <PresentationGuide />
    </div>
  );
}
