// Shared domain types (mirror the database tables).

export type OppStatus = "open" | "won" | "lost" | "unknown";

export interface SalesOpportunity {
  id: string;
  business_id: string;
  source_file_id: string | null;
  source_row: number | null;
  customer: string | null;
  amount: number | null;
  quoted_on: string | null;
  last_contact_on: string | null;
  last_contact_unknown: boolean;
  status: OppStatus;
  raw_status: string | null;
  raw?: Record<string, unknown>;
}

export interface Invoice {
  id: string;
  business_id: string;
  source_file_id: string | null;
  source_row: number | null;
  invoice_no: string | null;
  customer: string | null;
  issued_on: string | null;
  due_on: string | null;
  total_amount: number | null;
  amount_due: number | null;
}

export interface Payment {
  id: string;
  invoice_id: string | null;
  amount: number;
  paid_on: string;
  note?: string | null;
}

export interface Expense {
  id: string;
  business_id: string;
  source_file_id: string | null;
  source_row: number | null;
  spent_on: string | null;
  category: string | null;
  vendor: string | null;
  amount: number | null;
}

export interface Appointment {
  id: string;
  client: string | null;
  scheduled_on: string | null;
  service: string | null;
  amount: number | null;
  status: "booked" | "completed" | "cancelled" | "no_show" | "unknown";
}

export interface ManualWeek {
  id: string;
  week_start: string;
  available_slots: number | null;
  booked: number | null;
  cancellations: number | null;
  unfilled_slots: number | null;
  avg_service_value: number | null;
  weekly_sales: number | null;
}

export interface CashPosition {
  as_of: string;
  cash_on_hand: number;
}

export interface Business {
  id: string;
  slug: string | null;
  sponsor_id: string | null;
  name: string;
  industry: string | null;
  sales_tracking: string | null;
  invoicing: string | null;
  biggest_challenge: string | null;
  ai_experience: string | null;
  main_goal: string | null;
  data_path: "spreadsheet" | "manual";
  onboarded: boolean;
  is_sample: boolean;
}

/** Answers to the readiness questionnaire. All optional: unanswered means "not verified". */
export interface ProfileAnswers {
  lead_sources?: string;
  estimate_process?: string;
  followup_tracking?: string;
  invoice_process?: string;
  manual_tasks?: string;
  time_lost?: string;
  systems?: string[]; // paper, spreadsheets, email, accounting, pos, crm, appointments
  records_maintainer?: string;
  reviewer?: string;
  update_frequency?: string;
  staff_tool_comfort?: "low" | "medium" | "high";
  customer_permission?: "yes" | "no" | "unsure";
  financial_access?: string;
  human_approval?: "yes" | "no" | "unsure";
  sensitive_handling?: string;
}

export interface RecordRef {
  type: "sales_opportunity" | "invoice" | "expense" | "appointment" | "manual_week";
  id: string;
  label?: string;
}
