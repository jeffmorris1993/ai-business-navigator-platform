import { handle } from "@/lib/http";
import { requireOwner } from "@/lib/auth/session";
import { runAssessment } from "@/lib/readiness/engine";

export const POST = handle(async () => {
  const { businessId } = await requireOwner();
  return runAssessment(businessId, "Owner requested a recheck");
});
