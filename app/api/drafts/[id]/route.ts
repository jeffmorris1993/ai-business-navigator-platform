import { handle, jsonBody } from "@/lib/http";
import { requireOwner } from "@/lib/auth/session";
import { editDraft, approveDraft } from "@/lib/services/actions";

export const PATCH = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { businessId } = await requireOwner();
  const { id } = await params;
  const b = await jsonBody<{ action: "edit" | "approve"; subject?: string; body?: string }>(req);
  if (b.action === "approve") return approveDraft(businessId, id);
  return editDraft(businessId, id, String(b.subject ?? ""), String(b.body ?? ""));
});
