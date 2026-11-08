import { requireOwner, AuthError } from "@/lib/auth/session";
import { db } from "@/lib/db/client";

// Export approved drafts as plain text for the owner to send from their own email.
export async function GET() {
  try {
    const { businessId } = await requireOwner();
    const rows = (await db().from("drafts").select("recipient,subject,body,approved_at,kind").eq("business_id", businessId).eq("status", "approved").order("approved_at")).data ?? [];
    const text = rows.length
      ? rows.map((d) => `To: ${d.recipient ?? ""}\nSubject: ${d.subject ?? ""}\nType: ${d.kind}\nApproved: ${d.approved_at}\n\n${d.body}\n\n${"-".repeat(60)}\n`).join("\n")
      : "No approved drafts yet.\n";
    return new Response(`APPROVED DRAFTS (not sent; copy into your own email)\n\n${text}`, { headers: { "content-type": "text/plain; charset=utf-8", "content-disposition": 'attachment; filename="approved-drafts.txt"' } });
  } catch (e) {
    return new Response(e instanceof AuthError ? "Unauthorized" : "Error", { status: e instanceof AuthError ? 401 : 500 });
  }
}
