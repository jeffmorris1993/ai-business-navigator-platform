import { redirect } from "next/navigation";
import { ownerPage } from "@/lib/page-auth";
import { getBusiness, listBusinesses } from "@/lib/db/repo";
import { db } from "@/lib/db/client";
import { liveAiAvailable, aiModel } from "@/lib/ai/openai";
import { Sidebar, type RailProps } from "@/components/app/sidebar";
import { CommandBar } from "@/components/app/command-bar";
import { AdvisorDrawer } from "@/components/app/advisor-drawer";
import { PresentationGuide } from "@/components/app/demo-guide";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { businessId } = await ownerPage();
  const [business, openTasks, drafts, pending, findings, businesses, scan] = await Promise.all([
    getBusiness(businessId),
    db().from("tasks").select("id", { count: "exact", head: true }).eq("business_id", businessId).in("status", ["open", "in_progress"]),
    db().from("drafts").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("status", "draft"),
    db().from("pending_actions").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("status", "pending"),
    db().from("findings").select("id", { count: "exact", head: true }).eq("business_id", businessId).in("status", ["new", "needs_review", "action_prepared", "in_progress"]),
    listBusinesses(),
    db().from("intelligence_scans").select("status,started_at,finished_at").eq("business_id", businessId).order("started_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!business.onboarded) redirect("/onboarding");
  const rail: RailProps = {
    counts: { findings: findings.count ?? 0, actions: (openTasks.count ?? 0) + (drafts.count ?? 0) + (pending.count ?? 0) },
    business: { id: business.id, name: business.name, industry: business.industry },
    businesses: businesses.map((b) => ({ id: b.id, name: b.name, industry: b.industry })),
    isSample: business.is_sample,
    liveAi: liveAiAvailable(),
    scan: scan.data ?? null,
  };
  return (
    <div className="min-h-screen lg:pl-[256px]">
      <Sidebar {...rail} />
      <CommandBar rail={rail} businessName={business.name} slug={business.slug} model={aiModel()} />
      <main className="mx-auto w-full max-w-[1440px] px-4 pb-24 pt-8 sm:px-8 lg:pt-10 xl:px-12">{children}</main>
      <AdvisorDrawer liveAi={rail.liveAi} />
      <PresentationGuide />
    </div>
  );
}
