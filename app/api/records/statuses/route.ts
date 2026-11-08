import { handle, jsonBody } from "@/lib/http";
import { requireOwner } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { runAssessment } from "@/lib/readiness/engine";
import { logEvent } from "@/lib/db/repo";
import { ActionError } from "@/lib/services/actions";

// Owner explains what an unclear status word means; applied to matching records and saved mappings.
export const POST = handle(async (req: Request) => {
  const { businessId } = await requireOwner();
  const { meanings } = await jsonBody<{ meanings: Record<string, string> }>(req);
  let changed = 0;
  for (const [raw, status] of Object.entries(meanings ?? {})) {
    if (!["open", "won", "lost"].includes(status)) throw new ActionError("Choose open, won or lost.");
    const r = await db().from("sales_opportunities").update({ status, updated_at: new Date().toISOString() }).eq("business_id", businessId).eq("raw_status", raw).select("id");
    changed += r.data?.length ?? 0;
    const maps = (await db().from("column_mappings").select("id,status_map").eq("business_id", businessId).eq("record_type", "sales_opportunity")).data ?? [];
    for (const m of maps) await db().from("column_mappings").update({ status_map: { ...(m.status_map as object), [raw]: status } }).eq("id", m.id);
  }
  await logEvent(businessId, "records_updated", { field: "status", changed });
  return { changed, assessment: await runAssessment(businessId, "Clarified sales status meanings") };
});
