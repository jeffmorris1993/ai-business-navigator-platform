import "server-only";
import { redirect } from "next/navigation";
import { getSession } from "./auth/session";
import { db } from "./db/client";

export async function ownerPage(): Promise<{ businessId: string }> {
  const s = await getSession();
  if (!s || s.role !== "owner") redirect("/?signin=1");
  const exists = await db().from("businesses").select("id").eq("id", s.businessId).maybeSingle();
  if (!exists.data) redirect("/?signin=1");
  return { businessId: s.businessId };
}

export async function sponsorPage(): Promise<{ sponsorId: string }> {
  const s = await getSession();
  if (!s || s.role !== "sponsor") redirect("/sponsor-access");
  return { sponsorId: s.sponsorId };
}
