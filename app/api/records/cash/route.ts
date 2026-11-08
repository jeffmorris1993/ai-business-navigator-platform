import { handle, jsonBody } from "@/lib/http";
import { requireOwner } from "@/lib/auth/session";
import { saveCash } from "@/lib/services/actions";

export const POST = handle(async (req: Request) => {
  const { businessId } = await requireOwner();
  const b = await jsonBody<{ asOf: string; cash: number }>(req);
  return saveCash(businessId, String(b.asOf), Number(b.cash));
});
