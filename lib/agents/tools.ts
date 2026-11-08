import "server-only";
import { z } from "zod";
import * as repo from "../db/repo";
import { db, must } from "../db/client";
import { demoToday } from "../calc/dates";
import { formatMoney } from "../calc/money";
import { calculatePipeline, findStaleOpportunities, findStalledProposals, analyzeSalesTrends, analyzeAppointmentCapacity } from "../calc/sales";
import { findOverdueInvoices, analyzeExpenses, financialSummary, calculateCashScenario } from "../calc/finance";
import { loadReadinessInput, runAssessment } from "../readiness/engine";
import { assessAll, summarizeAreas, CAPABILITIES, RULES, type CapabilityKey } from "../readiness/rules";
import * as actions from "../services/actions";
import type { ToolDef, ToolContext } from "./types";
import { CATEGORY_KEYS, categoryDef } from "../intelligence/categories";
import { upsertFinding, listFindings, getFinding, resolveFinding } from "../intelligence/findings";

const ALL = ["readiness", "sales", "finance", "advisor"] as const;
const capKeys = CAPABILITIES.map((c) => c.key) as [CapabilityKey, ...CapabilityKey[]];

function def<S extends z.ZodTypeAny>(t: ToolDef<S>): ToolDef<S> {
  return t;
}

/** Readiness gate: analysis tools refuse when the deterministic rules say the data isn't there. */
async function gate(ctx: ToolContext, cap: CapabilityKey) {
  const input = await loadReadinessInput(ctx.businessId);
  const r = RULES[cap](input);
  return { input, result: r, allowed: r.status === "ready" || r.status === "partial" };
}

function blocked(cap: CapabilityKey, r: { status: string; missing: string[]; nextStep: string | null; fixAction: string | null }) {
  const label = CAPABILITIES.find((c) => c.key === cap)!.label;
  return {
    summary: `${label} isn't available yet: ${r.missing[0] ?? "information missing"}`,
    data: { available: false, capability: cap, status: r.status, missing: r.missing, nextStep: r.nextStep, fixAction: r.fixAction },
    links: [{ label: "Fix in My AI Readiness", href: "/readiness" }],
  };
}

export const TOOLS: ToolDef[] = [
  // ---------------- Readiness ----------------
  def({
    name: "get_business_profile",
    description: "Get the business's profile: name, industry, tools used, biggest challenge, goal, AI experience, and questionnaire answers.",
    input: z.object({}),
    agents: [...ALL],
    async run(ctx) {
      const [b, a] = await Promise.all([repo.getBusiness(ctx.businessId), repo.getAnswers(ctx.businessId)]);
      return { summary: `Loaded profile for ${b.name}`, data: { name: b.name, industry: b.industry, sales_tracking: b.sales_tracking, invoicing: b.invoicing, biggest_challenge: b.biggest_challenge, ai_experience: b.ai_experience, main_goal: b.main_goal, data_path: b.data_path, answers: a, today: demoToday() } };
    },
  }),
  def({
    name: "inspect_business_data",
    description: "Count the records the business has (sales, invoices, expenses, weekly entries, cash) and check field coverage such as missing dates or balances.",
    input: z.object({}),
    agents: [...ALL],
    async run(ctx) {
      const i = await loadReadinessInput(ctx.businessId);
      const open = i.opps.filter((o) => o.status === "open");
      const data = {
        sales: { total: i.opps.length, open: open.length, withAmount: i.opps.filter((o) => o.amount != null).length, openWithLastContact: open.filter((o) => o.last_contact_on).length, openContactUnknown: open.filter((o) => o.last_contact_unknown).length, unknownStatus: i.opps.filter((o) => o.status === "unknown").length },
        invoices: { total: i.invoices.length, withDueDate: i.invoices.filter((v) => v.due_on).length, withBalance: i.invoices.filter((v) => v.amount_due != null).length },
        expenses: { total: i.expenses.length, dated: i.expenses.filter((e) => e.spent_on).length },
        manualWeeks: i.weeks.length,
        cashOnHandEntered: Boolean(i.cash),
        lastUpdated: i.lastUpdated,
      };
      return { summary: `Inspected data: ${i.opps.length} sales records, ${i.invoices.length} invoices, ${i.expenses.length} expenses, ${i.weeks.length} weekly entries`, data };
    },
  }),
  def({
    name: "assess_capability_readiness",
    description: "Run the deterministic readiness checks for one capability or all of them. Returns status (ready, partial, needs_setup, not_assessed), evidence, missing items and next step. Does not save history.",
    input: z.object({ capability: z.enum(capKeys).optional().describe("Omit to check all capabilities") }),
    agents: [...ALL],
    async run(ctx, { capability }) {
      const i = await loadReadinessInput(ctx.businessId);
      const results = capability ? [RULES[capability](i)] : assessAll(i);
      const ready = results.filter((r) => r.status === "ready").length;
      return { summary: capability ? `Checked ${CAPABILITIES.find((c) => c.key === capability)!.label}: ${results[0].status.replace("_", " ")}` : `Checked ${results.length} capabilities: ${ready} ready`, data: results, links: [{ label: "My AI Readiness", href: "/readiness" }] };
    },
  }),
  def({
    name: "identify_missing_fields",
    description: "List the specific information that is missing and which capabilities it would unlock.",
    input: z.object({}),
    agents: [...ALL],
    async run(ctx) {
      const results = assessAll(await loadReadinessInput(ctx.businessId));
      const gaps = results.filter((r) => r.status !== "ready" && r.missing.length).map((r) => ({ capability: CAPABILITIES.find((c) => c.key === r.capability)!.label, status: r.status, missing: r.missing, fixAction: r.fixAction }));
      return { summary: `Found ${gaps.length} capabilities with missing information`, data: gaps };
    },
  }),
  def({
    name: "generate_readiness_plan",
    description: "Build an ordered plan of setup steps (most valuable first) from the readiness results, plus the five readiness areas summary.",
    input: z.object({}),
    agents: ["readiness", "advisor"],
    async run(ctx) {
      const i = await loadReadinessInput(ctx.businessId);
      const results = assessAll(i);
      const rank = { needs_setup: 0, partial: 1, not_assessed: 2, ready: 3 } as const;
      const steps = results
        .filter((r) => r.status !== "ready" && r.nextStep)
        .sort((a, b) => rank[a.status] - rank[b.status])
        .map((r, n) => ({ step: n + 1, capability: CAPABILITIES.find((c) => c.key === r.capability)!.label, status: r.status, action: r.nextStep, fixAction: r.fixAction }));
      return { summary: `Prepared a ${steps.length}-step readiness plan`, data: { steps, areas: summarizeAreas(i, results) }, links: [{ label: "My AI Readiness", href: "/readiness" }] };
    },
  }),
  def({
    name: "reassess_readiness",
    description: "Re-run readiness checks and save them to history. Use after records change. Returns which capabilities changed status.",
    input: z.object({ reason: z.string().max(200).default("Requested by AI Advisor") }),
    agents: [...ALL],
    async run(ctx, { reason }) {
      const r = await runAssessment(ctx.businessId, reason);
      return { summary: r.changes.length ? `Reassessed readiness: ${r.changes.map((c) => `${c.label} → ${c.to.replace("_", " ")}`).join("; ")}` : "Reassessed readiness: no changes", data: { changes: r.changes } };
    },
  }),

  // ---------------- Sales ----------------
  def({
    name: "list_sales_opportunities",
    description: "List sales opportunities/estimates, optionally filtered by status. Returns customer, amount, dates and status with record ids.",
    input: z.object({ status: z.enum(["open", "won", "lost", "unknown"]).optional(), limit: z.number().int().min(1).max(100).default(50) }),
    agents: ["sales", "advisor"],
    async run(ctx, { status, limit }) {
      const opps = (await repo.listOpportunities(ctx.businessId)).filter((o) => !status || o.status === status);
      return { summary: `Reviewed ${opps.length} ${status ?? ""} sales records`.replace("  ", " "), data: { count: opps.length, records: opps.slice(0, limit).map((o) => ({ id: o.id, customer: o.customer, amount: o.amount, quoted_on: o.quoted_on, last_contact_on: o.last_contact_on, status: o.status, source_row: o.source_row })) }, links: [{ label: "Sales Intelligence", href: "/sales" }] };
    },
  }),
  def({
    name: "calculate_pipeline",
    description: "Calculate open pipeline value and won/lost totals from sales records. Pipeline value is potential, not guaranteed revenue.",
    input: z.object({}),
    agents: ["sales", "advisor"],
    async run(ctx) {
      const g = await gate(ctx, "sales_pipeline");
      if (!g.allowed) return blocked("sales_pipeline", g.result);
      const p = calculatePipeline(g.input.opps);
      return { summary: `Calculated pipeline: ${p.open.count} open worth ${formatMoney(p.open.value)} (potential)`, data: { ...p, note: "Open value is potential pipeline value, not guaranteed revenue." }, links: [{ label: "Sales Intelligence", href: "/sales" }] };
    },
  }),
  def({
    name: "find_stale_opportunities",
    description: "Find open opportunities with no recorded contact for more than N days (default 7), ranked by value and urgency. Requires last-contact dates.",
    input: z.object({ days: z.number().int().min(1).max(180).default(7) }),
    agents: ["sales", "advisor"],
    async run(ctx, { days }) {
      const g = await gate(ctx, "missed_followup");
      if (!g.allowed) return blocked("missed_followup", g.result);
      const r = findStaleOpportunities(g.input.opps, demoToday(), days);
      return {
        summary: `Reviewed ${r.openReviewed} open estimates; ${r.stale.length} have no contact in over ${days} days (${formatMoney(r.totalValue)} potential pipeline value)`,
        data: { ...r, stale: r.stale.slice(0, 25), note: "Total is potential pipeline value, not guaranteed revenue." },
        links: [{ label: "Review in Sales Intelligence", href: "/sales" }],
      };
    },
  }),
  def({
    name: "find_stalled_proposals",
    description: "Find open proposals quoted more than N days ago that are still undecided.",
    input: z.object({ older_than_days: z.number().int().min(7).max(365).default(30) }),
    agents: ["sales", "advisor"],
    async run(ctx, { older_than_days }) {
      const g = await gate(ctx, "sales_pipeline");
      if (!g.allowed) return blocked("sales_pipeline", g.result);
      const r = findStalledProposals(g.input.opps, demoToday(), older_than_days);
      return { summary: `Found ${r.count} proposals open longer than ${older_than_days} days (${formatMoney(r.totalValue)})`, data: r };
    },
  }),
  def({
    name: "analyze_sales_trends",
    description: "Month-by-month quotes, wins and losses. Reports if there isn't enough history.",
    input: z.object({}),
    agents: ["sales", "advisor"],
    async run(ctx) {
      const g = await gate(ctx, "sales_trends");
      if (!g.allowed) return blocked("sales_trends", g.result);
      const r = analyzeSalesTrends(g.input.opps);
      return { summary: `Analyzed sales trends across ${r.points.length} months`, data: r };
    },
  }),
  def({
    name: "analyze_appointment_capacity",
    description: "Estimate unused appointment capacity and its value from weekly numbers the owner entered. Cannot identify individual customers.",
    input: z.object({}),
    agents: ["sales", "advisor"],
    async run(ctx) {
      const g = await gate(ctx, "appointment_capacity");
      if (!g.allowed) return blocked("appointment_capacity", g.result);
      const r = analyzeAppointmentCapacity(g.input.weeks);
      return { summary: `Analyzed ${r.weeks} weeks: ${r.totalUnusedSlots} unused or cancelled slots${r.estimatedUnusedValue != null ? ` (~${formatMoney(r.estimatedUnusedValue)} at your average service value)` : ""}`, data: r, links: [{ label: "Sales Intelligence", href: "/sales" }] };
    },
  }),
  def({
    name: "draft_sales_followup",
    description: "Prepare a follow-up message draft for one opportunity. The owner must review and approve it; nothing is sent.",
    input: z.object({ opportunity_id: z.string().uuid(), finding_id: z.string().uuid().optional().describe("The finding this draft addresses") }),
    agents: ["sales", "advisor"],
    async run(ctx, { opportunity_id, finding_id }) {
      const d = await actions.draftSalesFollowup(ctx.businessId, opportunity_id, finding_id);
      return { summary: `Prepared a follow-up draft (${d.written_by === "ai" ? "written by AI" : "from template"}) for review`, data: { draft_id: d.id, subject: d.subject, body: d.body, status: "draft", sent: false }, links: [{ label: "Review drafts", href: "/actions#drafts" }] };
    },
  }),

  // ---------------- Finance ----------------
  def({
    name: "list_invoices",
    description: "List invoices with balances and due dates. Filter to unpaid if needed.",
    input: z.object({ unpaid_only: z.boolean().default(false), limit: z.number().int().min(1).max(100).default(50) }),
    agents: ["finance", "advisor"],
    async run(ctx, { unpaid_only, limit }) {
      const inv = (await repo.listInvoices(ctx.businessId)).filter((i) => !unpaid_only || (i.amount_due ?? 0) > 0);
      return { summary: `Reviewed ${inv.length} ${unpaid_only ? "unpaid " : ""}invoices`, data: { count: inv.length, invoices: inv.slice(0, limit).map((i) => ({ id: i.id, invoice_no: i.invoice_no, customer: i.customer, due_on: i.due_on, total_amount: i.total_amount, amount_due: i.amount_due })) }, links: [{ label: "Financial Intelligence", href: "/finance" }] };
    },
  }),
  def({
    name: "find_overdue_invoices",
    description: "Find unpaid invoices past their due date with exact totals, aging buckets and per-customer totals. Requires due dates and balances.",
    input: z.object({}),
    agents: ["finance", "advisor"],
    async run(ctx) {
      const g = await gate(ctx, "overdue_invoices");
      if (!g.allowed) return blocked("overdue_invoices", g.result);
      const r = findOverdueInvoices(g.input.invoices, demoToday());
      return { summary: `Checked ${g.input.invoices.length} invoices; ${r.count} overdue totaling ${formatMoney(r.total, { cents: true })}`, data: r, links: [{ label: "Review in Financial Intelligence", href: "/finance" }] };
    },
  }),
  def({
    name: "analyze_expenses",
    description: "Compare recent months of expenses with earlier months by category to find rising costs.",
    input: z.object({ window_months: z.number().int().min(1).max(6).default(3) }),
    agents: ["finance", "advisor"],
    async run(ctx, { window_months }) {
      const g = await gate(ctx, "expense_trends");
      if (!g.allowed) return blocked("expense_trends", g.result);
      const r = analyzeExpenses(g.input.expenses, demoToday(), window_months);
      return { summary: r.sufficient ? `Compared expenses ${r.priorPeriod} vs ${r.recentPeriod}: ${r.totalChangePct}% change; biggest increase in ${r.categories[0]?.category}` : r.reason, data: r, links: [{ label: "Financial Intelligence", href: "/finance" }] };
    },
  }),
  def({
    name: "calculate_financial_summary",
    description: "Monthly billed amounts vs expenses, and outstanding/overdue balances.",
    input: z.object({}),
    agents: ["finance", "advisor"],
    async run(ctx) {
      const i = await loadReadinessInput(ctx.businessId);
      if (!i.invoices.length && !i.expenses.length) return { summary: "No invoices or expenses to summarize", data: { available: false, missing: ["Invoices or expenses"] } };
      const r = financialSummary(i.invoices, i.expenses, demoToday());
      return { summary: `Summarized ${r.months.length} months; ${formatMoney(r.balances.totalOutstanding)} outstanding`, data: r };
    },
  }),
  def({
    name: "calculate_cash_scenario",
    description: "Project cash over the next N days under three scenarios. Refuses and lists missing information if cash on hand, receivables or expense history are absent.",
    input: z.object({ horizon_days: z.number().int().min(14).max(120).default(60) }),
    agents: ["finance", "advisor"],
    async run(ctx, { horizon_days }) {
      const i = await loadReadinessInput(ctx.businessId);
      const r = calculateCashScenario({ cash: i.cash, invoices: i.invoices, expenses: i.expenses, asOf: demoToday(), horizonDays: horizon_days });
      return { summary: r.available ? `Built ${horizon_days}-day cash scenarios from ${formatMoney(r.startingCash)} starting cash` : `Can't build a cash forecast: missing ${r.missing.length} item(s)`, data: r, links: r.available ? [] : [{ label: "Add missing information", href: "/readiness" }] };
    },
  }),
  def({
    name: "draft_payment_reminder",
    description: "Prepare a polite payment reminder draft for one unpaid invoice. The owner must review and approve it; nothing is sent.",
    input: z.object({ invoice_id: z.string().uuid(), finding_id: z.string().uuid().optional().describe("The finding this draft addresses") }),
    agents: ["finance", "advisor"],
    async run(ctx, { invoice_id, finding_id }) {
      const d = await actions.draftPaymentReminder(ctx.businessId, invoice_id, finding_id);
      return { summary: `Prepared a payment reminder draft (${d.written_by === "ai" ? "written by AI" : "from template"}) for review`, data: { draft_id: d.id, subject: d.subject, body: d.body, status: "draft", sent: false }, links: [{ label: "Review drafts", href: "/actions#drafts" }] };
    },
  }),

  // ---------------- Actions ----------------
  def({
    name: "list_tasks",
    description: "List tasks in the shared action plan.",
    input: z.object({ status: z.enum(["open", "in_progress", "done", "dismissed"]).optional() }),
    agents: [...ALL],
    async run(ctx, { status }) {
      let q = db().from("tasks").select("id,title,priority,status,source_agent,created_at").eq("business_id", ctx.businessId).order("created_at", { ascending: false }).limit(50);
      if (status) q = q.eq("status", status);
      const rows = must(await q, "Tasks") as unknown[];
      return { summary: `Reviewed ${rows.length} tasks`, data: rows, links: [{ label: "My Action Plan", href: "/actions" }] };
    },
  }),
  def({
    name: "create_task",
    description: "Add a recommended task to the owner's action plan with priority, explanation and supporting record ids.",
    input: z.object({
      title: z.string().min(3).max(200),
      explanation: z.string().max(2000),
      priority: z.enum(["high", "medium", "low"]).default("medium"),
      record_refs: z.array(z.object({ type: z.enum(["sales_opportunity", "invoice", "expense", "appointment", "manual_week"]), id: z.string(), label: z.string().max(120).optional() })).max(50).default([]),
      finding_id: z.string().uuid().optional().describe("The finding this task addresses"),
    }),
    agents: [...ALL],
    async run(ctx, i) {
      if (i.finding_id && !(await getFinding(ctx.businessId, i.finding_id))) throw new Error("finding_id not found");
      const r = await actions.createTask(ctx.businessId, { ...i, source_agent: ctx.agent === "orchestrator" ? "advisor" : ctx.agent });
      return { summary: r.duplicate ? `Task already in your plan: "${i.title}"` : `Created task: "${i.title}"`, data: r, links: [{ label: "My Action Plan", href: "/actions" }] };
    },
  }),
  def({
    name: "update_task",
    description: "Change a task's status (open, in_progress, done, dismissed with reason) or assignee.",
    input: z.object({ task_id: z.string().uuid(), status: z.enum(["open", "in_progress", "done", "dismissed"]).optional(), dismissed_reason: z.string().max(500).optional(), assignee: z.string().max(80).optional() }),
    agents: [...ALL],
    async run(ctx, i) {
      await actions.updateTask(ctx.businessId, i.task_id, i);
      return { summary: `Updated task${i.status ? ` to ${i.status.replace("_", " ")}` : ""}`, data: { updated: true } };
    },
  }),
  def({
    name: "prepare_draft",
    description: "Prepare a message draft for a record: kind 'sales_followup' needs an opportunity id; 'payment_reminder' needs an invoice id. Nothing is sent.",
    input: z.object({ kind: z.enum(["sales_followup", "payment_reminder"]), record_id: z.string().uuid() }),
    agents: ["sales", "finance", "advisor"],
    async run(ctx, { kind, record_id }) {
      if (kind === "sales_followup" && ctx.agent === "finance") throw new Error("The Financial Agent can't draft sales messages.");
      if (kind === "payment_reminder" && ctx.agent === "sales") throw new Error("The Sales Agent can't draft payment reminders.");
      const d = kind === "sales_followup" ? await actions.draftSalesFollowup(ctx.businessId, record_id) : await actions.draftPaymentReminder(ctx.businessId, record_id);
      return { summary: `Prepared a ${kind.replace("_", " ")} draft for review`, data: { draft_id: d.id, subject: d.subject, body: d.body, sent: false }, links: [{ label: "Review drafts", href: "/actions#drafts" }] };
    },
  }),
  def({
    name: "approve_draft",
    description: "Approve a draft for the owner to copy or export. Requires the owner's approval click. Does not send anything.",
    input: z.object({ draft_id: z.string().uuid() }),
    agents: ["sales", "finance", "advisor"],
    sensitive: true,
    async run(ctx, { draft_id }) {
      const r = await actions.approveDraft(ctx.businessId, draft_id);
      return { summary: "Draft approved (not sent)", data: r };
    },
  }),
  def({
    name: "update_record",
    description: "Change fields on a sales opportunity (customer, amount, quoted_on, last_contact_on, status) or invoice (customer, due_on, invoice_no). Requires owner approval.",
    input: z.object({ record_type: z.enum(["sales_opportunity", "invoice"]), record_id: z.string().uuid(), changes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])) }),
    agents: ["sales", "advisor"],
    sensitive: true,
    async run(ctx, i) {
      const r = await actions.updateRecord(ctx.businessId, i.record_type, i.record_id, i.changes);
      return { summary: `Updated ${i.record_type.replace("_", " ")} (${r.fields.join(", ")})`, data: r };
    },
  }),
  def({
    name: "record_payment",
    description: "Record a payment against an invoice; reduces its balance. Requires owner approval.",
    input: z.object({ invoice_id: z.string().uuid(), amount: z.number().positive().max(10_000_000), paid_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), note: z.string().max(200).optional() }),
    agents: ["finance", "advisor"],
    sensitive: true,
    async run(ctx, i) {
      const r = await actions.recordPayment(ctx.businessId, i.invoice_id, i.amount, i.paid_on, i.note);
      return { summary: `Recorded ${formatMoney(i.amount, { cents: true })} on invoice ${r.invoice_no}; new balance ${formatMoney(r.newBalance, { cents: true })}`, data: r };
    },
  }),

  // ---------------- Intelligence findings ----------------
  def({
    name: "list_open_findings",
    description: "List findings from earlier intelligence scans that are still open (with ids, category, record refs, software-computed value and status). Check this before recording, so you update or resolve instead of duplicating.",
    input: z.object({ category: z.enum(CATEGORY_KEYS).optional() }),
    agents: ["readiness", "sales", "finance", "advisor", "orchestrator"],
    async run(ctx, { category }) {
      const rows = (await listFindings(ctx.businessId, { open: true })).filter((f) => !category || f.category === category);
      return { summary: `Reviewed ${rows.length} open findings from earlier scans`, data: rows.map((f) => ({ id: f.id, agent: f.agent, category: f.category, title: f.title, priority: f.priority, status: f.status, value: f.value, value_kind: f.value_kind, subject: f.subject, record_refs: f.record_refs, last_verified_at: f.last_verified_at })) };
    },
  }),
  def({
    name: "record_finding",
    description: "Save a finding to the owner's Intelligence Inbox. Software validates the record references, computes the dollar value and merges it with an existing open finding about the same issue. Categories: " + CATEGORY_KEYS.join(", ") + ".",
    input: z.object({
      category: z.enum(CATEGORY_KEYS),
      title: z.string().min(5).max(160).describe("Short, specific, no dollar amounts"),
      explanation: z.string().min(10).max(1500).describe("What, why it matters, evidence"),
      priority: z.enum(["critical", "high", "medium", "low"]),
      record_refs: z.array(z.object({ type: z.enum(["sales_opportunity", "invoice", "expense_category", "capability", "customer"]), id: z.string().max(120), label: z.string().max(120).optional() })).max(40).default([]),
      subject: z.string().max(120).optional().describe("Customer name for customer_balance; expense category for expense_increase; capability key for readiness_gap"),
      evidence_quality: z.enum(["verified_records", "partial_records", "owner_reported"]).default("verified_records"),
      recommended_action: z.string().min(5).max(400),
    }),
    agents: ["readiness", "sales", "finance"],
    async run(ctx, i) {
      const def = categoryDef(i.category)!;
      if (def.agent !== ctx.agent) throw new Error(`The ${ctx.agent} agent can't record ${i.category} findings (owned by the ${def.agent} agent).`);
      const r = await upsertFinding(ctx.businessId, { ...i, agent: ctx.agent as "readiness" | "sales" | "finance", scanId: ctx.scanId, runId: ctx.runId });
      if (!r.ok) throw new Error(r.error);
      return { summary: `${r.outcome === "created" ? "Recorded new" : "Updated existing"} finding: ${i.title}`, data: { finding_id: r.id, outcome: r.outcome, software_computed_value: r.value, value_kind: r.value_kind, records: r.qualifyingRefs }, links: [{ label: "Intelligence Inbox", href: `/inbox?f=${r.id}` }] };
    },
  }),
  def({
    name: "resolve_finding",
    description: "Close an open finding that your investigation shows no longer applies. Give the reason.",
    input: z.object({ finding_id: z.string().uuid(), reason: z.string().min(5).max(300) }),
    agents: ["readiness", "sales", "finance"],
    async run(ctx, { finding_id, reason }) {
      const f = await getFinding(ctx.businessId, finding_id);
      if (!f) throw new Error("Finding not found");
      if (f.agent !== ctx.agent && f.agent !== "software") throw new Error(`That finding belongs to the ${f.agent} agent.`);
      const ok = await resolveFinding(ctx.businessId, finding_id, "ai_scan", reason);
      return { summary: ok ? `Resolved finding: ${f.title}` : "Finding was already closed", data: { resolved: ok } };
    },
  }),
  def({
    name: "get_finding",
    description: "Get one finding with its supporting records (estimates or invoices), linked drafts and tasks. Use to explain why something was prioritized.",
    input: z.object({ finding_id: z.string().uuid() }),
    agents: ["readiness", "sales", "finance", "advisor", "orchestrator"],
    async run(ctx, { finding_id }) {
      const f = await getFinding(ctx.businessId, finding_id);
      if (!f) throw new Error("Finding not found");
      const ids = f.record_refs.map((r) => r.id);
      const [opps, invs, drafts, tasks] = await Promise.all([
        ids.length ? db().from("sales_opportunities").select("id,customer,amount,quoted_on,last_contact_on,status,source_row").eq("business_id", ctx.businessId).in("id", ids) : Promise.resolve({ data: [] }),
        ids.length ? db().from("invoices").select("id,invoice_no,customer,due_on,total_amount,amount_due,source_row").eq("business_id", ctx.businessId).in("id", ids) : Promise.resolve({ data: [] }),
        db().from("drafts").select("id,kind,recipient,status").eq("business_id", ctx.businessId).eq("finding_id", finding_id),
        db().from("tasks").select("id,title,status").eq("business_id", ctx.businessId).eq("finding_id", finding_id),
      ]);
      return { summary: `Loaded finding "${f.title}" with ${ids.length} supporting records`, data: { finding: f, opportunities: opps.data, invoices: invs.data, drafts: drafts.data, tasks: tasks.data, today: demoToday() }, links: [{ label: "Open in Inbox", href: `/inbox?f=${f.id}` }] };
    },
  }),
  def({
    name: "prioritize_findings",
    description: "Set the final priority of open findings after comparing them across sales, finance and readiness.",
    input: z.object({ priorities: z.array(z.object({ finding_id: z.string().uuid(), priority: z.enum(["critical", "high", "medium", "low"]) })).min(1).max(30) }),
    agents: ["orchestrator"],
    async run(ctx, { priorities }) {
      let n = 0;
      for (const p of priorities) {
        const r = await db().from("findings").update({ priority: p.priority }).eq("id", p.finding_id).eq("business_id", ctx.businessId).select("id");
        n += r.data?.length ?? 0;
      }
      return { summary: `Prioritized ${n} findings`, data: { updated: n } };
    },
  }),
];

export function toolsFor(agent: string) {
  return TOOLS.filter((t) => t.agents.includes(agent as never));
}

export function getTool(name: string) {
  return TOOLS.find((t) => t.name === name);
}
