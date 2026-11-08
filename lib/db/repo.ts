import "server-only";
import { db, must } from "./client";
import type {
  Business, ProfileAnswers, SalesOpportunity, Invoice, Expense, Appointment, ManualWeek, CashPosition,
} from "../types";

// Every function takes businessId from the server-side session. Tool arguments never choose the business.

const num = (v: unknown) => (v == null ? null : Number(v));

export async function getBusiness(businessId: string): Promise<Business> {
  return must(await db().from("businesses").select("*").eq("id", businessId).single(), "Load business");
}

export async function listBusinesses() {
  return must(
    await db().from("businesses").select("id,slug,name,industry,data_path,onboarded,sponsor_id").eq("is_cohort_sim", false).order("created_at"),
    "List businesses",
  ) as Array<Pick<Business, "id" | "slug" | "name" | "industry" | "data_path" | "onboarded" | "sponsor_id">>;
}

export async function getAnswers(businessId: string): Promise<ProfileAnswers> {
  const r = await db().from("business_profile_answers").select("answers").eq("business_id", businessId).maybeSingle();
  return (r.data?.answers as ProfileAnswers) ?? {};
}

export async function saveAnswers(businessId: string, answers: ProfileAnswers) {
  const current = await getAnswers(businessId);
  must(
    await db().from("business_profile_answers").upsert({ business_id: businessId, answers: { ...current, ...answers }, updated_at: new Date().toISOString() }),
    "Save answers",
  );
}

export async function listOpportunities(businessId: string): Promise<SalesOpportunity[]> {
  const rows = must(await db().from("sales_opportunities").select("*").eq("business_id", businessId).order("source_row", { nullsFirst: false }), "Load opportunities") as SalesOpportunity[];
  return rows.map((r) => ({ ...r, amount: num(r.amount) }));
}

export async function listInvoices(businessId: string): Promise<Invoice[]> {
  const rows = must(await db().from("invoices").select("*").eq("business_id", businessId).order("due_on", { nullsFirst: false }), "Load invoices") as Invoice[];
  return rows.map((r) => ({ ...r, total_amount: num(r.total_amount), amount_due: num(r.amount_due) }));
}

export async function listExpenses(businessId: string): Promise<Expense[]> {
  const rows = must(await db().from("expenses").select("*").eq("business_id", businessId).order("spent_on"), "Load expenses") as Expense[];
  return rows.map((r) => ({ ...r, amount: num(r.amount) }));
}

export async function listAppointments(businessId: string): Promise<Appointment[]> {
  const rows = must(await db().from("appointments").select("*").eq("business_id", businessId), "Load appointments") as Appointment[];
  return rows.map((r) => ({ ...r, amount: num(r.amount) }));
}

export async function listWeeks(businessId: string): Promise<ManualWeek[]> {
  const rows = must(await db().from("manual_weekly_entries").select("*").eq("business_id", businessId).order("week_start"), "Load weekly entries") as ManualWeek[];
  return rows.map((r) => ({ ...r, avg_service_value: num(r.avg_service_value), weekly_sales: num(r.weekly_sales) }));
}

export async function latestCash(businessId: string): Promise<CashPosition | null> {
  const r = await db().from("cash_positions").select("as_of,cash_on_hand").eq("business_id", businessId).order("as_of", { ascending: false }).limit(1).maybeSingle();
  return r.data ? { as_of: r.data.as_of, cash_on_hand: Number(r.data.cash_on_hand) } : null;
}

export async function listSourceFiles(businessId: string) {
  return must(await db().from("source_files").select("*").eq("business_id", businessId).order("uploaded_at", { ascending: false }), "Load files") as Array<{
    id: string; filename: string; record_type: string; row_count: number; uploaded_at: string; import_mode: string; storage_path: string | null;
  }>;
}

export async function logEvent(businessId: string, kind: string, payload: Record<string, unknown> = {}) {
  await db().from("events").insert({ business_id: businessId, kind, payload });
}

export async function listEvents(businessId: string, limit = 20) {
  return must(await db().from("events").select("*").eq("business_id", businessId).order("created_at", { ascending: false }).limit(limit), "Load events") as Array<{
    id: string; kind: string; payload: Record<string, unknown>; created_at: string;
  }>;
}
