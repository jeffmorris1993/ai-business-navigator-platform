// Convert normalized records into database rows for each record type.
import type { NormalizedRecord } from "./normalize";
import type { RecordType } from "./schemas";

export function toDbRows(recordType: RecordType, records: NormalizedRecord[], businessId: string, sourceFileId: string | null) {
  return records.map((r) => {
    const v = r.values;
    const base = { business_id: businessId, source_file_id: sourceFileId, source_row: r.source_row, raw: r.raw };
    switch (recordType) {
      case "sales_opportunity":
        return {
          ...base,
          customer: v.customer,
          amount: v.amount,
          quoted_on: v.quoted_on,
          last_contact_on: v.last_contact_on,
          last_contact_unknown: !v.last_contact_on && v.__last_contact_unknown === 1,
          status: v.status ?? "unknown",
          raw_status: v.__raw_status ?? null,
        };
      case "invoice":
        return { ...base, invoice_no: v.invoice_no, customer: v.customer, issued_on: v.issued_on, due_on: v.due_on, total_amount: v.total_amount, amount_due: v.amount_due };
      case "payment":
        return { ...base, amount: v.amount, paid_on: v.paid_on, note: v.note, __invoice_no: v.invoice_no };
      case "expense":
        return { ...base, spent_on: v.spent_on, category: v.category, vendor: v.vendor, amount: v.amount };
      case "appointment":
        return { ...base, client: v.client, scheduled_on: v.scheduled_on, service: v.service, amount: v.amount, status: v.status ?? "unknown" };
    }
  });
}
