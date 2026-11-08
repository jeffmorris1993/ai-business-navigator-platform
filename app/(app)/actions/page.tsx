import { ownerPage } from "@/lib/page-auth";
import { db } from "@/lib/db/client";
import { PageHeader } from "@/components/app/status";
import { ActionCenter } from "@/components/app/action-center";

export const dynamic = "force-dynamic";

export default async function ActionsPage() {
  const { businessId } = await ownerPage();
  const [tasks, drafts, pending] = await Promise.all([
    db().from("tasks").select("*").eq("business_id", businessId).order("created_at", { ascending: false }),
    db().from("drafts").select("*").eq("business_id", businessId).order("created_at", { ascending: false }).limit(50),
    db().from("pending_actions").select("id,tool,summary,created_at").eq("business_id", businessId).eq("status", "pending").order("created_at", { ascending: false }),
  ]);
  return (
    <>
      <PageHeader title="My Action Plan" description="Recommended tasks from your Readiness, Sales and Financial agents, message drafts waiting for your review, and actions that need your approval." />
      <ActionCenter tasks={tasks.data ?? []} drafts={drafts.data ?? []} pending={pending.data ?? []} />
    </>
  );
}
