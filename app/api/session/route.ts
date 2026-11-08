import { handle, jsonBody } from "@/lib/http";
import { setSession, clearSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { ActionError } from "@/lib/services/actions";

// Prototype sign-in: pick a sample business (owner) or a sponsor. See docs/SECURITY_GAPS.md.
export const POST = handle(async (req: Request) => {
  const b = await jsonBody<{ role: string; businessId?: string; businessSlug?: string; sponsorSlug?: string }>(req);
  if (b.role === "owner") {
    let q = db().from("businesses").select("id,onboarded").eq("is_cohort_sim", false);
    q = b.businessId ? q.eq("id", b.businessId) : q.eq("slug", b.businessSlug ?? "");
    const r = await q.maybeSingle();
    if (!r.data) throw new ActionError("Business not found.");
    await setSession({ role: "owner", businessId: r.data.id });
    return { ok: true, onboarded: r.data.onboarded };
  }
  if (b.role === "sponsor") {
    const r = await db().from("sponsors").select("id").eq("slug", b.sponsorSlug ?? "").maybeSingle();
    if (!r.data) throw new ActionError("Sponsor not found.");
    await setSession({ role: "sponsor", sponsorId: r.data.id });
    return { ok: true };
  }
  throw new ActionError("Unknown role.");
});

export const DELETE = handle(async () => {
  await clearSession();
  return { ok: true };
});
