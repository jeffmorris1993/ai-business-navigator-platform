import { handle } from "@/lib/http";
import { requireOwner } from "@/lib/auth/session";
import { listFindings } from "@/lib/intelligence/findings";

// The current business's findings (owner only).
export const GET = handle(async (req: Request) => {
  const { businessId } = await requireOwner();
  const status = new URL(req.url).searchParams.get("status");
  const all = await listFindings(businessId);
  const open = all.filter((f) => ["new", "needs_review", "action_prepared", "in_progress"].includes(f.status));
  return { open: open.length, findings: status === "all" ? all : open };
});
