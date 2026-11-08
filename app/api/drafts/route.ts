import { handle, jsonBody } from "@/lib/http";
import { requireOwner } from "@/lib/auth/session";
import { draftSalesFollowup, draftPaymentReminder, ActionError } from "@/lib/services/actions";

export const POST = handle(async (req: Request) => {
  const { businessId } = await requireOwner();
  const b = await jsonBody<{ kind: string; recordId: string }>(req);
  if (b.kind === "sales_followup") return draftSalesFollowup(businessId, String(b.recordId));
  if (b.kind === "payment_reminder") return draftPaymentReminder(businessId, String(b.recordId));
  throw new ActionError("Unknown draft type.");
});
