import { handle, jsonBody } from "@/lib/http";
import { requireOwner } from "@/lib/auth/session";
import { setContactDates } from "@/lib/services/actions";

export const POST = handle(async (req: Request) => {
  const { businessId } = await requireOwner();
  const { updates } = await jsonBody<{ updates: Array<{ id: string; date: string | null; unknown: boolean }> }>(req);
  return setContactDates(businessId, Array.isArray(updates) ? updates : []);
});
