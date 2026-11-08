import { handle, jsonBody } from "@/lib/http";
import { requireOwner } from "@/lib/auth/session";
import { getFinding, dismissFinding, resolveFinding, setFindingStatus, rollupStatuses } from "@/lib/intelligence/findings";
import { categoryDef } from "@/lib/intelligence/categories";
import { draftSalesFollowup, draftPaymentReminder, createTask, ActionError } from "@/lib/services/actions";
import { logEvent } from "@/lib/db/repo";

// Owner actions on a finding.
export const PATCH = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { businessId } = await requireOwner();
  const { id } = await params;
  const f = await getFinding(businessId, id);
  if (!f) throw new ActionError("Finding not found.");
  const b = await jsonBody<{ action: string; reason?: string; recordId?: string }>(req);
  switch (b.action) {
    case "in_progress":
      await setFindingStatus(businessId, id, "in_progress");
      await logEvent(businessId, "finding_started", { id });
      return { ok: true };
    case "reopen":
      await setFindingStatus(businessId, id, "new");
      return { ok: true };
    case "dismiss":
      if (!b.reason?.trim()) throw new ActionError("Please give a reason for dismissing.");
      await dismissFinding(businessId, id, b.reason);
      await logEvent(businessId, "finding_dismissed", { id });
      return { ok: true };
    case "resolve":
      await resolveFinding(businessId, id, "owner", b.reason?.trim() || "Marked resolved by the owner");
      return { ok: true };
    case "draft": {
      const def = categoryDef(f.category);
      const recordId = b.recordId ?? f.record_refs[0]?.id;
      if (!recordId || !f.record_refs.some((r) => r.id === recordId)) throw new ActionError("Choose a record from this finding.");
      const d = def?.refType === "invoice" ? await draftPaymentReminder(businessId, recordId, id) : def?.refType === "sales_opportunity" ? await draftSalesFollowup(businessId, recordId, id) : null;
      if (!d) throw new ActionError("Drafts are available for estimate and invoice findings.");
      return d;
    }
    case "task": {
      const r = await createTask(businessId, { source_agent: f.agent === "software" ? "owner" : f.agent, title: f.recommended_action?.slice(0, 180) ?? f.title, explanation: f.explanation, priority: f.priority === "critical" ? "high" : f.priority, finding_id: id, record_refs: f.record_refs.filter((r) => r.type === "sales_opportunity" || r.type === "invoice").map((r) => ({ type: r.type as "sales_opportunity" | "invoice", id: r.id, label: r.label })) });
      await rollupStatuses(businessId);
      return r;
    }
  }
  throw new ActionError("Unknown action.");
});
