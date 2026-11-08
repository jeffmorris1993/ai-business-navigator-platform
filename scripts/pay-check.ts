import { recordPayment } from "../lib/services/actions";
import { listFindings } from "../lib/intelligence/findings";
import { db } from "../lib/db/client";
(async () => {
  const b = (await db().from("businesses").select("id").eq("slug", "metro-roofing").single()).data!;
  const inv = (await db().from("invoices").select("id,invoice_no,amount_due").eq("business_id", b.id).eq("invoice_no", "1050").single()).data!;
  const r = await recordPayment(b.id, inv.id, Number(inv.amount_due), "2026-11-08", "Demo payment");
  console.log("payment:", r.invoice_no, r.previousBalance, "->", r.newBalance, JSON.stringify(r.verification));
  for (const x of await listFindings(b.id)) console.log(`- [${x.status}${x.resolved_by ? "/" + x.resolved_by : ""}] ${x.category}: ${x.title} | ${x.value} | ${x.resolution_note ?? ""}`);
})();
