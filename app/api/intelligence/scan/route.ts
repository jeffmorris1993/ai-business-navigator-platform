import { requireOwner, AuthError } from "@/lib/auth/session";
import { liveAiAvailable } from "@/lib/ai/openai";
import { runScan, ScanBusy, type ScanTrigger } from "@/lib/intelligence/scan";
import { ndjson } from "@/lib/stream";

export const maxDuration = 300;

// Starts an Intelligence Scan and streams real agent activity as it happens.
export async function POST(req: Request) {
  let businessId: string;
  try {
    ({ businessId } = await requireOwner());
  } catch (e) {
    return Response.json({ error: e instanceof AuthError ? e.message : "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const trigger: ScanTrigger = body.mode === "software_only" ? "software_only" : body.followUp ? "follow_up" : "manual";
  if (trigger !== "software_only" && !liveAiAvailable()) {
    return Response.json({ error: "Live AI is unavailable: no OpenAI API key is configured on the server. You can run software checks only (clearly labeled, no AI).", code: "live_ai_unavailable" }, { status: 503 });
  }
  return ndjson(async (send) => {
    try {
      await runScan({ businessId, trigger, scopeHint: trigger === "follow_up" ? "Follow-up scan after the owner took action. Re-check earlier findings against the current records." : null, onEvent: send });
    } catch (e) {
      if (e instanceof ScanBusy) send({ type: "error", error: e.message, code: "busy" });
      // other errors were already reported through onEvent
    }
  });
}
