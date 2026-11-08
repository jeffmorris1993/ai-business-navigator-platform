import { handle, jsonBody } from "@/lib/http";
import { requireOwner } from "@/lib/auth/session";
import { decidePending } from "@/lib/agents/run";

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { businessId } = await requireOwner();
  const { id } = await params;
  const { approve } = await jsonBody<{ approve: boolean }>(req);
  return decidePending(businessId, id, Boolean(approve));
});
