// Standard record types and fields the importer maps spreadsheet columns into.

export type RecordType = "sales_opportunity" | "invoice" | "payment" | "expense" | "appointment";
export type FieldKind = "text" | "money" | "date" | "status";

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  required: boolean;
  help: string;
  synonyms: string[];
}

export const RECORD_TYPES: Record<RecordType, { label: string; table: string; fields: FieldDef[]; statuses?: string[] }> = {
  sales_opportunity: {
    label: "Sales opportunities / estimates",
    table: "sales_opportunities",
    statuses: ["open", "won", "lost"],
    fields: [
      { key: "customer", label: "Customer name", kind: "text", required: true, help: "Who the estimate or proposal is for", synonyms: ["customer", "client", "homeowner", "organization", "company", "name", "account", "prospect", "lead"] },
      { key: "amount", label: "Estimate value", kind: "money", required: true, help: "Quoted price or proposal fee", synonyms: ["amount", "bid", "bid amt", "value", "fee", "proposal fee", "quote", "price", "estimate", "total"] },
      { key: "quoted_on", label: "Date quoted", kind: "date", required: false, help: "When the estimate or proposal was sent", synonyms: ["date quoted", "quoted", "submitted", "sent", "date", "proposal date", "estimate date", "created"] },
      { key: "last_contact_on", label: "Last contact date", kind: "date", required: false, help: "When you last called, emailed or met them", synonyms: ["last contact", "last call", "last email", "last touch", "contacted", "follow up", "last follow"] },
      { key: "status", label: "Status", kind: "status", required: true, help: "Open, won or lost", synonyms: ["status", "result", "stage", "outcome", "state"] },
    ],
  },
  invoice: {
    label: "Invoices",
    table: "invoices",
    fields: [
      { key: "invoice_no", label: "Invoice number", kind: "text", required: false, help: "Invoice # or reference", synonyms: ["invoice", "invoice #", "invoice no", "num", "number", "ref", "inv"] },
      { key: "customer", label: "Customer name", kind: "text", required: true, help: "Who owes the money", synonyms: ["customer", "client", "bill to", "name", "account"] },
      { key: "issued_on", label: "Invoice date", kind: "date", required: false, help: "When the invoice was issued", synonyms: ["date", "invoice date", "issued", "created"] },
      { key: "due_on", label: "Due date", kind: "date", required: false, help: "When payment is due", synonyms: ["due", "due date", "payment due"] },
      { key: "total_amount", label: "Invoice total", kind: "money", required: false, help: "Original invoice total (not the same as what's still owed)", synonyms: ["total", "total amount", "amount", "invoice total"] },
      { key: "amount_due", label: "Amount still owed", kind: "money", required: false, help: "Unpaid balance / open balance / amount due", synonyms: ["amount due", "balance", "open balance", "balance due", "outstanding", "unpaid"] },
    ],
  },
  payment: {
    label: "Payments received",
    table: "payments",
    fields: [
      { key: "invoice_no", label: "Invoice number", kind: "text", required: false, help: "Which invoice this payment is for", synonyms: ["invoice", "invoice #", "invoice no", "ref"] },
      { key: "amount", label: "Payment amount", kind: "money", required: true, help: "Amount received", synonyms: ["amount", "paid", "payment", "received"] },
      { key: "paid_on", label: "Payment date", kind: "date", required: true, help: "When it was received", synonyms: ["date", "paid on", "payment date", "received on"] },
      { key: "note", label: "Note", kind: "text", required: false, help: "Memo", synonyms: ["memo", "note", "method"] },
    ],
  },
  expense: {
    label: "Expenses",
    table: "expenses",
    fields: [
      { key: "spent_on", label: "Date", kind: "date", required: true, help: "When the expense happened", synonyms: ["date", "transaction date", "posted", "spent"] },
      { key: "category", label: "Category", kind: "text", required: false, help: "Food, labor, rent, supplies...", synonyms: ["category", "type", "account", "class"] },
      { key: "vendor", label: "Vendor", kind: "text", required: false, help: "Who was paid", synonyms: ["vendor", "payee", "supplier", "merchant", "description"] },
      { key: "amount", label: "Amount", kind: "money", required: true, help: "How much was spent", synonyms: ["amount", "cost", "total", "debit", "spent"] },
    ],
  },
  appointment: {
    label: "Appointments",
    table: "appointments",
    statuses: ["booked", "completed", "cancelled", "no_show"],
    fields: [
      { key: "client", label: "Client name", kind: "text", required: false, help: "Who booked", synonyms: ["client", "customer", "name", "guest"] },
      { key: "scheduled_on", label: "Appointment date", kind: "date", required: true, help: "Date of appointment", synonyms: ["date", "appointment", "scheduled", "when"] },
      { key: "service", label: "Service", kind: "text", required: false, help: "What was booked", synonyms: ["service", "treatment", "type"] },
      { key: "amount", label: "Price", kind: "money", required: false, help: "Service price", synonyms: ["price", "amount", "value", "cost"] },
      { key: "status", label: "Status", kind: "status", required: false, help: "Booked, completed, cancelled, no-show", synonyms: ["status", "result", "outcome"] },
    ],
  },
};

// Status words we can interpret without asking. Anything else is sent to the owner to confirm.
export const KNOWN_STATUS: Record<string, Record<string, string>> = {
  sales_opportunity: {
    open: "open", pending: "open", quoted: "open", sent: "open", "proposal sent": "open", negotiating: "open",
    "in progress": "open", waiting: "open", "waiting on ho": "open", "follow up": "open", submitted: "open", "under review": "open", estimate: "open",
    won: "won", sold: "won", signed: "won", accepted: "won", "closed won": "won", "closed-won": "won", booked: "won",
    lost: "lost", declined: "lost", rejected: "lost", "closed lost": "lost", "closed-lost": "lost", dead: "lost", "went elsewhere": "lost", "no sale": "lost",
  },
  appointment: {
    booked: "booked", scheduled: "booked", confirmed: "booked", completed: "completed", done: "completed", showed: "completed",
    cancelled: "cancelled", canceled: "cancelled", "no show": "no_show", "no-show": "no_show", noshow: "no_show",
  },
};

// Words that sound clear but could mean more than one thing. Always asked about.
export const AMBIGUOUS_STATUS = new Set(["closed", "complete", "completed", "done", "hold", "on hold", "inactive", "finished"]);

export function headerSignature(headers: string[]): string {
  return headers.map((h) => h.trim().toLowerCase()).sort().join("|");
}
