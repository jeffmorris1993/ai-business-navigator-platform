import { handle, jsonBody } from "@/lib/http";
import { requireOwner } from "@/lib/auth/session";
import { saveWeek } from "@/lib/services/actions";

const n = (v: unknown) => (v === "" || v == null ? null : Number(v));

export const POST = handle(async (req: Request) => {
  const { businessId } = await requireOwner();
  const b = await jsonBody<Record<string, unknown>>(req);
  return saveWeek(businessId, {
    week_start: String(b.week_start ?? ""), available_slots: n(b.available_slots), booked: n(b.booked), cancellations: n(b.cancellations),
    unfilled_slots: n(b.unfilled_slots), avg_service_value: n(b.avg_service_value), weekly_sales: n(b.weekly_sales),
  });
});
