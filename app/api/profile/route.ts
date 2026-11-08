import { handle, jsonBody } from "@/lib/http";
import { requireOwner } from "@/lib/auth/session";
import { saveAnswers, logEvent } from "@/lib/db/repo";
import { runAssessment } from "@/lib/readiness/engine";
import type { ProfileAnswers } from "@/lib/types";

const KEYS: Array<keyof ProfileAnswers> = ["lead_sources", "estimate_process", "followup_tracking", "invoice_process", "manual_tasks", "time_lost", "systems", "records_maintainer", "reviewer", "update_frequency", "staff_tool_comfort", "customer_permission", "financial_access", "human_approval", "sensitive_handling"];

export const POST = handle(async (req: Request) => {
  const { businessId } = await requireOwner();
  const body = await jsonBody<Record<string, unknown>>(req);
  const clean: Record<string, unknown> = {};
  for (const k of KEYS) {
    if (!(k in body)) continue;
    const v = body[k];
    clean[k] = Array.isArray(v) ? v.slice(0, 10).map((x) => String(x).slice(0, 40)) : v == null ? undefined : String(v).slice(0, 300);
  }
  await saveAnswers(businessId, clean as ProfileAnswers);
  await logEvent(businessId, "profile_updated", { fields: Object.keys(clean) });
  return runAssessment(businessId, "Questionnaire answers updated");
});
