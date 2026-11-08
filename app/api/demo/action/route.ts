import { handle, jsonBody } from "@/lib/http";
import { requireOwner } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { recordPayment, setContactDates, ActionError } from "@/lib/services/actions";
import { listInvoices, listOpportunities } from "@/lib/db/repo";
import { findOverdueInvoices } from "@/lib/calc/finance";
import { findStaleOpportunities } from "@/lib/calc/sales";
import { demoToday } from "@/lib/calc/dates";
import { formatMoney } from "@/lib/calc/money";

// Demo Mode "Apply a sample change": real record updates on fictional sample businesses only.
export const POST = handle(async (req: Request) => {
  const { businessId } = await requireOwner();
  const b = (await db().from("businesses").select("is_sample").eq("id", businessId).single()).data;
  if (!b?.is_sample) throw new ActionError("Sample changes are only available for fictional sample businesses.");
  const { action } = await jsonBody<{ action: "record_payment" | "contact_estimate" }>(req);
  const today = demoToday();
  if (action === "record_payment") {
    const o = findOverdueInvoices(await listInvoices(businessId), today);
    const target = [...o.overdue].sort((a, b) => b.amount_due - a.amount_due)[0];
    if (!target) throw new ActionError("There are no overdue invoices to pay.");
    const r = await recordPayment(businessId, target.id, target.amount_due, today, "Sample payment (demo)");
    return { description: `Recorded a ${formatMoney(target.amount_due, { cents: true })} payment from ${target.customer} on invoice #${target.invoice_no}.`, verification: r.verification };
  }
  if (action === "contact_estimate") {
    const s = findStaleOpportunities(await listOpportunities(businessId), today);
    const target = [...s.stale].sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))[0];
    if (!target) throw new ActionError("There are no stale estimates to update.");
    const r = await setContactDates(businessId, [{ id: target.id, date: today, unknown: false }]);
    return { description: `Marked ${target.customer}'s ${formatMoney(target.amount)} estimate as contacted today (${today}).`, verification: r.verification };
  }
  throw new ActionError("Unknown sample change.");
});
