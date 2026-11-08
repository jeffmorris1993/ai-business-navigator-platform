import { requireOwner, AuthError } from "@/lib/auth/session";
import { downloadSourceFile } from "@/lib/services/imports";

// Download the original uploaded file (owner of that business only).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { businessId } = await requireOwner();
    const { id } = await params;
    const f = await downloadSourceFile(businessId, id);
    if (!f) return new Response("Not found", { status: 404 });
    return new Response(new Uint8Array(f.bytes), { headers: { "content-type": "application/octet-stream", "content-disposition": `attachment; filename="${f.filename.replace(/[^A-Za-z0-9._-]/g, "_")}"` } });
  } catch (e) {
    return new Response(e instanceof AuthError ? "Unauthorized" : "Error", { status: e instanceof AuthError ? 401 : 500 });
  }
}
