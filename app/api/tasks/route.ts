import { handle, jsonBody } from "@/lib/http";
import { requireOwner } from "@/lib/auth/session";
import { createTask } from "@/lib/services/actions";
import type { RecordRef } from "@/lib/types";

export const POST = handle(async (req: Request) => {
  const { businessId } = await requireOwner();
  const b = await jsonBody<{ title: string; explanation?: string; priority?: string; source_agent?: string; record_refs?: RecordRef[] }>(req);
  const source = ["readiness", "sales", "finance", "owner"].includes(b.source_agent ?? "") ? b.source_agent! : "owner";
  return createTask(businessId, { ...b, source_agent: source });
});
