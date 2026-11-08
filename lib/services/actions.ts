import "server-only";
import { db, must } from "../db/client";
import * as repo from "../db/repo";
import { runAssessment } from "../readiness/engine";
import { applyPayment } from "../calc/finance";
import { demoToday, daysBetween, isValidIsoDate } from "../calc/dates";
import { formatMoney } from "../calc/money";
import { openai, aiModel } from "../ai/openai";
import type { RecordRef } from "../types";

export class ActionError extends Error {}

// ---------- Records ----------

export async function setContactDates(businessId: string, updates: Array<{ id: string; date: string | null; unknown: boolean }>) {
  let filled = 0;
  let unknown = 0;
  for (const u of updates.slice(0, 500)) {
    if (u.date && !isValidIsoDate(u.date)) throw new ActionError(`"${u.date}" isn't a valid date.`);
    if (u.date && u.date > demoToday()) throw new ActionError("Last contact dates can't be in the future.");
    const patch = { last_contact_on: u.date, last_contact_unknown: !u.date && u.unknown, updated_at: new Date().toISOString() };
    const r = await db().from("sales_opportunities").update(patch).eq("id", u.id).eq("business_id", businessId).select("id");
    if (r.error) throw new Error(r.error.message);
    if (r.data?.length) {
      if (u.date) filled += 1;
      else if (u.unknown) unknown += 1;
    }
  }
  await repo.logEvent(businessId, "records_updated", { field: "last_contact_on", filled, unknown });
  const assessment = await runAssessment(businessId, `Added ${filled} contact date(s), marked ${unknown} unknown`);
  return { filled, unknown, assessment };
}

export async function updateRecord(businessId: string, type: "sales_opportunity" | "invoice", id: string, patch: Record<string, unknown>) {
  const allowed: Record<string, string[]> = {
    sales_opportunity: ["customer", "amount", "quoted_on", "last_contact_on", "status", "last_contact_unknown"],
    invoice: ["customer", "due_on", "invoice_no"],
  };
  const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed[type].includes(k)));
  if (!Object.keys(clean).length) throw new ActionError("Nothing to update.");
  for (const k of ["quoted_on", "last_contact_on", "due_on"]) if (clean[k] != null && !isValidIsoDate(clean[k])) throw new ActionError(`Invalid date for ${k}.`);
  if (clean.status && !["open", "won", "lost", "unknown"].includes(String(clean.status))) throw new ActionError("Invalid status.");
  const table = type === "sales_opportunity" ? "sales_opportunities" : "invoices";
  const r = must(await db().from(table).update({ ...clean, updated_at: new Date().toISOString() }).eq("id", id).eq("business_id", businessId).select("id"), "Update record") as unknown[];
  if (!r.length) throw new ActionError("Record not found.");
  await repo.logEvent(businessId, "records_updated", { type, id, fields: Object.keys(clean) });
  await runAssessment(businessId, `Updated a ${type.replace("_", " ")}`);
  return { updated: true, fields: Object.keys(clean) };
}

export async function recordPayment(businessId: string, invoiceId: string, amount: number, paidOn: string, note?: string) {
  if (!isValidIsoDate(paidOn)) throw new ActionError("Enter a valid payment date.");
  const inv = (await db().from("invoices").select("id,invoice_no,customer,amount_due").eq("id", invoiceId).eq("business_id", businessId).single()).data;
  if (!inv) throw new ActionError("Invoice not found.");
  if (inv.amount_due == null) throw new ActionError("This invoice has no recorded balance, so a payment can't be applied.");
  const { newBalance, overpayment } = applyPayment(Number(inv.amount_due), amount);
  must(await db().from("payments").insert({ business_id: businessId, invoice_id: invoiceId, amount, paid_on: paidOn, note: note?.slice(0, 200) ?? "Recorded in Sirrom" }), "Save payment");
  must(await db().from("invoices").update({ amount_due: newBalance, updated_at: new Date().toISOString() }).eq("id", invoiceId).eq("business_id", businessId), "Update balance");
  await repo.logEvent(businessId, "payment_recorded", { invoice_no: inv.invoice_no, amount, newBalance });
  await runAssessment(businessId, `Payment recorded on invoice ${inv.invoice_no ?? ""}`.trim());
  return { invoice_no: inv.invoice_no, customer: inv.customer, previousBalance: Number(inv.amount_due), payment: amount, newBalance, overpayment };
}

export async function saveWeek(businessId: string, w: { week_start: string; available_slots?: number | null; booked?: number | null; cancellations?: number | null; unfilled_slots?: number | null; avg_service_value?: number | null; weekly_sales?: number | null }) {
  if (!isValidIsoDate(w.week_start)) throw new ActionError("Choose the week's start date.");
  for (const [k, v] of Object.entries(w)) if (k !== "week_start" && v != null && (typeof v !== "number" || v < 0 || !Number.isFinite(v))) throw new ActionError(`${k.replace(/_/g, " ")} must be a positive number.`);
  must(await db().from("manual_weekly_entries").upsert({ business_id: businessId, ...w }, { onConflict: "business_id,week_start" }), "Save week");
  await repo.logEvent(businessId, "manual_entry", { week_start: w.week_start });
  return runAssessment(businessId, `Weekly numbers entered for ${w.week_start}`);
}

export async function saveCash(businessId: string, asOf: string, cash: number) {
  if (!isValidIsoDate(asOf) || !Number.isFinite(cash)) throw new ActionError("Enter a valid date and amount.");
  must(await db().from("cash_positions").insert({ business_id: businessId, as_of: asOf, cash_on_hand: cash }), "Save cash");
  await repo.logEvent(businessId, "cash_entered", {});
  return runAssessment(businessId, "Cash on hand entered");
}

// ---------- Tasks ----------

export async function createTask(businessId: string, t: { source_agent: string; title: string; explanation?: string; priority?: string; record_refs?: RecordRef[] }) {
  const title = t.title.trim().slice(0, 200);
  if (!title) throw new ActionError("Task needs a title.");
  const dupe = await db().from("tasks").select("id").eq("business_id", businessId).eq("title", title).in("status", ["open", "in_progress"]).maybeSingle();
  if (dupe.data) return { id: dupe.data.id, duplicate: true };
  const r = must(
    await db().from("tasks").insert({
      business_id: businessId, source_agent: t.source_agent, title, explanation: t.explanation?.slice(0, 2000) ?? null,
      priority: ["high", "medium", "low"].includes(t.priority ?? "") ? t.priority : "medium", record_refs: (t.record_refs ?? []).slice(0, 50),
    }).select("id").single(),
    "Create task",
  ) as { id: string };
  await repo.logEvent(businessId, "task_created", { source: t.source_agent });
  return { id: r.id, duplicate: false };
}

export async function updateTask(businessId: string, id: string, patch: { status?: string; dismissed_reason?: string; assignee?: string }) {
  const p: Record<string, unknown> = {};
  if (patch.status) {
    if (!["open", "in_progress", "done", "dismissed"].includes(patch.status)) throw new ActionError("Invalid status.");
    p.status = patch.status;
    p.completed_at = patch.status === "done" ? new Date().toISOString() : null;
    if (patch.status === "dismissed") {
      if (!patch.dismissed_reason?.trim()) throw new ActionError("Please give a reason for dismissing.");
      p.dismissed_reason = patch.dismissed_reason.slice(0, 500);
    }
  }
  if (patch.assignee) p.assignee = patch.assignee.slice(0, 80);
  const r = must(await db().from("tasks").update(p).eq("id", id).eq("business_id", businessId).select("id,status"), "Update task") as unknown[];
  if (!r.length) throw new ActionError("Task not found.");
  if (patch.status === "done") {
    await repo.logEvent(businessId, "task_completed", { id });
    await runAssessment(businessId, "Completed a recommended action");
  }
  return { updated: true };
}

// ---------- Drafts (never sent; owner reviews, edits, approves, copies) ----------

async function writeWithAi(system: string, facts: Record<string, unknown>): Promise<{ subject: string; body: string } | null> {
  const ai = openai();
  if (!ai) return null;
  try {
    const c = await ai.chat.completions.create({
      model: aiModel(),
      messages: [
        { role: "system", content: system + " Use only the facts given. No made-up discounts, deadlines or promises. Under 120 words. Return JSON {\"subject\":string,\"body\":string}." },
        { role: "user", content: JSON.stringify(facts) },
      ],
      response_format: { type: "json_object" },
    });
    const j = JSON.parse(c.choices[0].message.content ?? "{}");
    if (typeof j.subject === "string" && typeof j.body === "string") return { subject: j.subject.slice(0, 200), body: j.body.slice(0, 3000) };
  } catch {}
  return null;
}

export async function draftSalesFollowup(businessId: string, opportunityId: string) {
  const b = await repo.getBusiness(businessId);
  const o = (await db().from("sales_opportunities").select("*").eq("id", opportunityId).eq("business_id", businessId).single()).data;
  if (!o) throw new ActionError("Opportunity not found.");
  const today = demoToday();
  const facts = {
    business: b.name, industry: b.industry, customer: o.customer, estimate_amount: o.amount != null ? formatMoney(Number(o.amount)) : null,
    quoted_on: o.quoted_on, days_since_last_contact: o.last_contact_on ? daysBetween(o.last_contact_on, today) : null,
  };
  const ai = await writeWithAi("You draft a friendly, brief follow-up from a small business owner to a customer about an open estimate.", facts);
  const first = String(o.customer ?? "there").split(/[ &]/)[0];
  const draft = ai ?? {
    subject: `Following up on your estimate from ${b.name}`,
    body: `Hi ${first},\n\nI wanted to follow up on the estimate we sent${o.quoted_on ? ` on ${o.quoted_on}` : ""}${o.amount != null ? ` for ${formatMoney(Number(o.amount))}` : ""}. Do you have any questions, or would it help to walk through the details together?\n\nHappy to work around your schedule.\n\nThanks,\n${b.name}`,
  };
  return saveDraft(businessId, { kind: "sales_followup", record_type: "sales_opportunity", record_id: o.id, recipient: o.customer, ...draft, written_by: ai ? "ai" : "template" });
}

export async function draftPaymentReminder(businessId: string, invoiceId: string) {
  const b = await repo.getBusiness(businessId);
  const i = (await db().from("invoices").select("*").eq("id", invoiceId).eq("business_id", businessId).single()).data;
  if (!i) throw new ActionError("Invoice not found.");
  if (!(Number(i.amount_due) > 0)) throw new ActionError("This invoice has no unpaid balance.");
  const today = demoToday();
  const facts = { business: b.name, customer: i.customer, invoice_no: i.invoice_no, amount_owed: formatMoney(Number(i.amount_due), { cents: true }), due_on: i.due_on, days_overdue: i.due_on ? Math.max(0, daysBetween(i.due_on, today)) : null };
  const ai = await writeWithAi("You draft a polite, professional payment reminder from a small business to a customer. Tone: courteous, never threatening.", facts);
  const draft = ai ?? {
    subject: `Reminder: invoice ${i.invoice_no ?? ""} from ${b.name}`.replace("  ", " "),
    body: `Hello ${i.customer ?? ""},\n\nThis is a friendly reminder that invoice ${i.invoice_no ?? ""}${i.due_on ? `, due ${i.due_on},` : ""} has a remaining balance of ${formatMoney(Number(i.amount_due), { cents: true })}. If you've already sent payment, thank you, and please disregard this note.\n\nLet us know if you have any questions.\n\nBest regards,\n${b.name}`,
  };
  return saveDraft(businessId, { kind: "payment_reminder", record_type: "invoice", record_id: i.id, recipient: i.customer, ...draft, written_by: ai ? "ai" : "template" });
}

async function saveDraft(businessId: string, d: { kind: string; record_type: string; record_id: string; recipient: string | null; subject: string; body: string; written_by: string }) {
  const r = must(await db().from("drafts").insert({ business_id: businessId, ...d }).select("*").single(), "Save draft");
  await repo.logEvent(businessId, "draft_prepared", { kind: d.kind });
  return r as unknown as { id: string; subject: string; body: string; written_by: string };
}

export async function editDraft(businessId: string, id: string, subject: string, body: string) {
  if (!body.trim()) throw new ActionError("The message can't be empty.");
  const r = must(await db().from("drafts").update({ subject: subject.slice(0, 200), body: body.slice(0, 5000), status: "draft", approved_at: null, updated_at: new Date().toISOString() }).eq("id", id).eq("business_id", businessId).select("id"), "Edit draft") as unknown[];
  if (!r.length) throw new ActionError("Draft not found.");
  return { updated: true };
}

export async function approveDraft(businessId: string, id: string) {
  const r = must(await db().from("drafts").update({ status: "approved", approved_at: new Date().toISOString() }).eq("id", id).eq("business_id", businessId).select("id"), "Approve draft") as unknown[];
  if (!r.length) throw new ActionError("Draft not found.");
  await repo.logEvent(businessId, "draft_approved", { id });
  return { approved: true, sent: false, note: "Approved for you to copy or export. Nothing was sent: no email integration is connected." };
}
