import { ownerPage } from "@/lib/page-auth";
import { db } from "@/lib/db/client";
import { PageHeader } from "@/components/app/status";
import { ActionCenter, type Task, type DraftRow, type FindingLite } from "@/components/app/action-center";

export const dynamic = "force-dynamic";

export default async function ActionsPage() {
  const { businessId } = await ownerPage();
  const [tasks, drafts, pending, findings] = await Promise.all([
    db().from("tasks").select("*").eq("business_id", businessId).order("created_at", { ascending: false }),
    db().from("drafts").select("*").eq("business_id", businessId).order("created_at", { ascending: false }).limit(60),
    db().from("pending_actions").select("id,tool,summary,created_at").eq("business_id", businessId).eq("status", "pending").order("created_at", { ascending: false }),
    db().from("findings").select("id,title,status,resolved_by,resolution_note,resolved_at,agent").eq("business_id", businessId).order("created_at", { ascending: false }),
  ]);
  return (
    <>
      <PageHeader title="Action Center" description="Where your agents' recommendations become business activity: review and approve prepared work, track tasks, and see which outcomes software has verified." />
      <ActionCenter tasks={(tasks.data ?? []) as Task[]} drafts={(drafts.data ?? []) as DraftRow[]} pending={pending.data ?? []} findings={(findings.data ?? []) as FindingLite[]} />
    </>
  );
}
