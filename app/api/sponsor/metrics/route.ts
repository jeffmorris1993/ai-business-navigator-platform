import { handle } from "@/lib/http";
import { requireSponsor } from "@/lib/auth/session";
import { sponsorMetrics } from "@/lib/services/sponsor";

export const GET = handle(async (req: Request) => {
  const { sponsorId } = await requireSponsor();
  const includeSim = new URL(req.url).searchParams.get("sim") !== "0";
  return sponsorMetrics(sponsorId, includeSim);
});
