import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

// Prototype sessions: a signed cookie that says who the viewer is.
// role "owner" can see one business; role "sponsor" sees only aggregate metrics for one sponsor.
// Production needs real authentication (see docs/SECURITY_GAPS.md).

export type Session =
  | { role: "owner"; businessId: string }
  | { role: "sponsor"; sponsorId: string };

const COOKIE = "sirrom_session";

function secret() {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  // Fallback: derive a separate signing key from the (secret) service-role key so deployments need one less variable.
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!srk) throw new Error("SESSION_SECRET is not configured.");
  return createHmac("sha256", srk).update("sirrom-session-cookie-v1").digest("hex");
}

export function sign(session: Session): string {
  const body = Buffer.from(JSON.stringify(session)).toString("base64url");
  const mac = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function verify(token: string | undefined): Session | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString());
    if (s.role === "owner" && typeof s.businessId === "string") return s;
    if (s.role === "sponsor" && typeof s.sponsorId === "string") return s;
  } catch {}
  return null;
}

export async function getSession(): Promise<Session | null> {
  const c = await cookies();
  return verify(c.get(COOKIE)?.value);
}

export async function setSession(session: Session) {
  const c = await cookies();
  c.set(COOKIE, sign(session), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 7 });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

export class AuthError extends Error {
  status = 401;
}

export async function requireOwner(): Promise<{ businessId: string }> {
  const s = await getSession();
  if (!s || s.role !== "owner") throw new AuthError("Sign in as a business owner to view this.");
  return { businessId: s.businessId };
}

export async function requireSponsor(): Promise<{ sponsorId: string }> {
  const s = await getSession();
  if (!s || s.role !== "sponsor") throw new AuthError("Sponsor access only.");
  return { sponsorId: s.sponsorId };
}
