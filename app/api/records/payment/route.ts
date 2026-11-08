import { handle, jsonBody } from "@/lib/http";
import { requireOwner } from "@/lib/auth/session";
import { recordPayment } from "@/lib/services/actions";

// The owner initiates this directly (that click is the approval).
export const POST = handle(async (req: Request) => {
  const { businessId } = await requireOwner();
  const b = await jsonBody<{ invoiceId: string; amount: number; paidOn: string; note?: string }>(req);
  return recordPayment(businessId, String(b.invoiceId), Number(b.amount), String(b.paidOn), b.note);
});
