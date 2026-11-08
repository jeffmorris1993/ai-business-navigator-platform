import { handle, jsonBody } from "@/lib/http";
import { setSession } from "@/lib/auth/session";
import { db, must } from "@/lib/db/client";
import { ActionError } from "@/lib/services/actions";

// Create a new (empty) business and sign in as its owner. Enrolled under the first sponsor program.
export const POST = handle(async (req: Request) => {
  const { name } = await jsonBody<{ name: string }>(req);
  const clean = String(name ?? "").trim().slice(0, 120);
  if (!clean) throw new ActionError("Enter your business name.");
  const sponsor = (await db().from("sponsors").select("id").order("created_at").limit(1).maybeSingle()).data;
  const b = must(await db().from("businesses").insert({ name: clean, sponsor_id: sponsor?.id ?? null, is_sample: false, onboarded: false }).select("id").single(), "Create business") as { id: string };
  await setSession({ role: "owner", businessId: b.id });
  return { id: b.id };
});
