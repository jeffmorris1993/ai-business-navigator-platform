import { handle, jsonBody } from "@/lib/http";
import { requireOwner } from "@/lib/auth/session";
import { db, must } from "@/lib/db/client";
import { saveAnswers, logEvent } from "@/lib/db/repo";
import { runAssessment } from "@/lib/readiness/engine";
import { ActionError } from "@/lib/services/actions";
import type { ProfileAnswers } from "@/lib/types";

const s = (v: unknown, n = 200) => (v == null ? null : String(v).trim().slice(0, n) || null);

export const POST = handle(async (req: Request) => {
  const { businessId } = await requireOwner();
  const b = await jsonBody<Record<string, unknown> & { answers?: ProfileAnswers }>(req);
  const name = s(b.name, 120);
  if (!name) throw new ActionError("Enter your business name.");
  const salesTracking = s(b.sales_tracking);
  const manual = /paper|notebook|book|none|not tracked/i.test(salesTracking ?? "");
  must(
    await db().from("businesses").update({
      name, industry: s(b.industry), sales_tracking: salesTracking, invoicing: s(b.invoicing), biggest_challenge: s(b.biggest_challenge),
      ai_experience: s(b.ai_experience), main_goal: s(b.main_goal), data_path: manual ? "manual" : "spreadsheet", onboarded: true,
    }).eq("id", businessId),
    "Save profile",
  );
  const answers = (b.answers ?? {}) as ProfileAnswers;
  const systems = new Set<string>(answers.systems ?? []);
  if (/excel|sheet|spreadsheet/i.test(salesTracking ?? "")) systems.add("spreadsheets");
  if (/quickbooks|freshbooks|xero|accounting/i.test(String(b.invoicing ?? ""))) systems.add("accounting");
  if (manual) systems.add("paper");
  await saveAnswers(businessId, { ...answers, systems: [...systems] });
  await logEvent(businessId, "onboarded", {});
  await runAssessment(businessId, "Onboarding answers");
  return { ok: true };
});
