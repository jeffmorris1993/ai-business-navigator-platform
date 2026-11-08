import { handle, jsonBody } from "@/lib/http";
import { requireOwner } from "@/lib/auth/session";
import { updateTask } from "@/lib/services/actions";

export const PATCH = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { businessId } = await requireOwner();
  const { id } = await params;
  return updateTask(businessId, id, await jsonBody(req));
});
