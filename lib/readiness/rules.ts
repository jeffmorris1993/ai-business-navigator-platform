// Deterministic readiness rules. The AI may explain these results but never overrides them.
import { daysBetween, monthKey } from "../calc/dates";
import { calculateCashScenario } from "../calc/finance";
import type {
  Business, ProfileAnswers, SalesOpportunity, Invoice, Expense, Appointment, ManualWeek, CashPosition,
} from "../types";

export type ReadinessStatus = "ready" | "partial" | "needs_setup" | "not_assessed";

export type CapabilityKey =
  | "sales_pipeline"
  | "missed_followup"
  | "sales_trends"
  | "appointment_capacity"
  | "communication_drafting"
  | "overdue_invoices"
  | "expense_trends"
  | "cash_flow";

export type FixAction =
  | "add_last_contact_dates"
  | "upload_sales"
  | "resolve_statuses"
  | "upload_invoices"
  | "fix_invoice_balances"
  | "upload_expenses"
  | "enter_cash"
  | "add_weekly_numbers"
  | "answer_privacy";

export interface CapabilityResult {
  capability: CapabilityKey;
  status: ReadinessStatus;
  evidence: string[];
  missing: string[];
  nextStep: string | null;
  fixAction: FixAction | null;
}

export const CAPABILITIES: Array<{ key: CapabilityKey; label: string; agent: "sales" | "finance"; description: string }> = [
  { key: "sales_pipeline", label: "Sales pipeline analysis", agent: "sales", description: "See your open estimates and their total value." },
  { key: "missed_followup", label: "Missed follow-up detection", agent: "sales", description: "Find open estimates nobody has followed up on recently." },
  { key: "sales_trends", label: "Sales trend analysis", agent: "sales", description: "Compare wins and quotes month by month." },
  { key: "appointment_capacity", label: "Unused appointment capacity", agent: "sales", description: "Estimate the value of empty or cancelled appointment slots." },
  { key: "communication_drafting", label: "Customer message drafting", agent: "sales", description: "Draft follow-ups and reminders for you to review and approve." },
  { key: "overdue_invoices", label: "Overdue invoice analysis", agent: "finance", description: "Find unpaid invoices past their due date." },
  { key: "expense_trends", label: "Expense trend analysis", agent: "finance", description: "Spot categories where spending is rising." },
  { key: "cash_flow", label: "Cash-flow scenario planning", agent: "finance", description: "Project cash over the next 60 days under a few what-ifs." },
];

export const STALE_DATA_DAYS = 60;

export interface ReadinessInput {
  business: Business;
  answers: ProfileAnswers;
  opps: SalesOpportunity[];
  invoices: Invoice[];
  expenses: Expense[];
  appointments: Appointment[];
  weeks: ManualWeek[];
  cash: CashPosition | null;
  lastUpdated: Partial<Record<"sales" | "invoices" | "expenses" | "manual", string>>; // ISO date
  asOf: string;
}

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

function isStale(last: string | undefined, asOf: string) {
  return last ? daysBetween(last, asOf) > STALE_DATA_DAYS : false;
}

export function salesPipeline(i: ReadinessInput): CapabilityResult {
  const o = i.opps;
  const base = { capability: "sales_pipeline" as const };
  if (o.length === 0) {
    return {
      ...base,
      status: i.business.data_path === "manual" ? "needs_setup" : "not_assessed",
      evidence: [],
      missing: ["Sales or estimate records (customer, amount, status)"],
      nextStep: "Upload your estimates or sales spreadsheet so I can look at real records.",
      fixAction: "upload_sales",
    };
  }
  const named = o.filter((r) => r.customer).length;
  const valued = o.filter((r) => r.amount != null).length;
  const statused = o.filter((r) => r.status !== "unknown").length;
  const evidence = [
    `${plural(o.length, "sales record")} imported`,
    `Customer names on ${named} of ${o.length} (${pct(named, o.length)}%)`,
    `Amounts on ${valued} of ${o.length} (${pct(valued, o.length)}%)`,
    `Recognizable status on ${statused} of ${o.length} (${pct(statused, o.length)}%)`,
  ];
  const missing: string[] = [];
  if (pct(named, o.length) < 90) missing.push(`${o.length - named} records have no customer name`);
  if (pct(valued, o.length) < 80) missing.push(`${o.length - valued} records have no amount`);
  if (pct(statused, o.length) < 80) missing.push(`${o.length - statused} records have a status I couldn't interpret`);
  const stale = isStale(i.lastUpdated.sales, i.asOf);
  if (stale) missing.push(`Sales records haven't been updated in over ${STALE_DATA_DAYS} days`);
  const ok = named / o.length >= 0.9 && valued / o.length >= 0.8 && statused / o.length >= 0.8 && o.length >= 5;
  if (ok && !stale) {
    return { ...base, status: "ready", evidence, missing, nextStep: "Review your open pipeline in Sales Intelligence.", fixAction: null };
  }
  const anyUsable = o.some((r) => r.status === "open" && r.amount != null);
  return {
    ...base,
    status: anyUsable ? "partial" : "needs_setup",
    evidence,
    missing,
    nextStep: stale ? "Upload your latest sales spreadsheet." : pct(statused, o.length) < 80 ? "Tell me what your unclear status values mean." : "Fill in the missing customer names or amounts.",
    fixAction: stale ? "upload_sales" : pct(statused, o.length) < 80 ? "resolve_statuses" : "upload_sales",
  };
}

export function missedFollowup(i: ReadinessInput): CapabilityResult {
  const base = { capability: "missed_followup" as const };
  if (i.opps.length === 0) {
    if (i.business.data_path === "manual" && i.weeks.length > 0) {
      return {
        ...base,
        status: "needs_setup",
        evidence: [`${plural(i.weeks.length, "week")} of totals entered`],
        missing: ["Customer-level records (names and last contact dates)"],
        nextStep: "Your weekly totals can't identify specific customers. Start a simple customer list if you want follow-up help.",
        fixAction: "upload_sales",
      };
    }
    return {
      ...base,
      status: "not_assessed",
      evidence: [],
      missing: ["Sales records with customer names and last contact dates"],
      nextStep: "Upload your estimates or sales spreadsheet first.",
      fixAction: "upload_sales",
    };
  }
  const open = i.opps.filter((o) => o.status === "open");
  if (open.length === 0) {
    return {
      ...base,
      status: "partial",
      evidence: [`${plural(i.opps.length, "record")} reviewed`, "No open estimates found"],
      missing: ["Open opportunities to follow up on"],
      nextStep: "Upload current open estimates when you have them.",
      fixAction: "upload_sales",
    };
  }
  const withDate = open.filter((o) => o.last_contact_on).length;
  const markedUnknown = open.filter((o) => !o.last_contact_on && o.last_contact_unknown).length;
  const missingCount = open.length - withDate - markedUnknown;
  const coverage = (withDate + markedUnknown) / open.length;
  const evidence = [
    `${plural(open.length, "open estimate")} found`,
    `Last contact date recorded on ${withDate} of ${open.length}`,
  ];
  if (markedUnknown) evidence.push(`${markedUnknown} confirmed as unknown by you (excluded from analysis)`);
  const missing: string[] = [];
  if (missingCount) missing.push(`Last contact date missing on ${plural(missingCount, "open estimate")}`);
  if (withDate === 0) {
    return {
      ...base,
      status: "needs_setup",
      evidence,
      missing: missing.length ? missing : ["Last contact dates"],
      nextStep: "Let's add a Last Contact Date so I can identify customers who may need follow-up.",
      fixAction: "add_last_contact_dates",
    };
  }
  if (coverage < 0.8) {
    return {
      ...base,
      status: "partial",
      evidence,
      missing,
      nextStep: `I can check the ${withDate} estimates with dates. Add the remaining dates (or mark them unknown) for a complete picture.`,
      fixAction: "add_last_contact_dates",
    };
  }
  if (isStale(i.lastUpdated.sales, i.asOf)) {
    return { ...base, status: "partial", evidence, missing: [...missing, "Contact dates may be out of date"], nextStep: "Upload your latest sales spreadsheet.", fixAction: "upload_sales" };
  }
  return { ...base, status: "ready", evidence, missing, nextStep: "Ask the Sales Agent to find missed follow-ups.", fixAction: null };
}

export function salesTrends(i: ReadinessInput): CapabilityResult {
  const base = { capability: "sales_trends" as const };
  const decided = i.opps.filter((o) => (o.status === "won" || o.status === "lost") && o.quoted_on);
  const months = new Set(decided.map((o) => monthKey(o.quoted_on!)));
  if (i.opps.length === 0) {
    return { ...base, status: "not_assessed", evidence: [], missing: ["Dated sales records"], nextStep: "Upload sales records with dates and outcomes.", fixAction: "upload_sales" };
  }
  const evidence = [`${plural(decided.length, "won/lost record")} with dates`, `Spanning ${plural(months.size, "month")}`];
  if (months.size >= 2 && decided.length >= 4) {
    return { ...base, status: "ready", evidence, missing: [], nextStep: "Ask the Sales Agent how sales are trending.", fixAction: null };
  }
  return {
    ...base,
    status: decided.length ? "partial" : "needs_setup",
    evidence,
    missing: ["Won/lost records with dates across at least two months"],
    nextStep: "Keep adding outcomes (won/lost) to your records; trends become available with more history.",
    fixAction: "upload_sales",
  };
}

export function appointmentCapacity(i: ReadinessInput): CapabilityResult {
  const base = { capability: "appointment_capacity" as const };
  const usable = i.weeks.filter((w) => w.unfilled_slots != null || (w.available_slots != null && w.booked != null));
  const valued = usable.filter((w) => w.avg_service_value != null).length;
  if (usable.length === 0 && i.appointments.length === 0) {
    const relevant = i.business.data_path === "manual" || /salon|spa|appointment|clinic|barber/i.test(i.business.industry ?? "");
    return {
      ...base,
      status: relevant ? "needs_setup" : "not_assessed",
      evidence: [],
      missing: ["Weekly appointment numbers (booked, cancelled, unfilled slots, average service value)"],
      nextStep: relevant ? "Enter last week's appointment numbers. It takes about a minute." : "Only relevant if you book appointments.",
      fixAction: relevant ? "add_weekly_numbers" : null,
    };
  }
  const evidence = [`${plural(usable.length, "week")} of appointment numbers entered`, `Average service value given for ${valued} of ${usable.length} weeks`];
  const missing: string[] = [];
  if (valued < usable.length) missing.push("Average service value missing for some weeks (needed to estimate dollar value)");
  if (isStale(i.lastUpdated.manual, i.asOf)) missing.push("No weekly numbers entered recently");
  if (usable.length >= 2 && valued === usable.length && missing.length === 0) {
    return { ...base, status: "ready", evidence, missing, nextStep: "See your unused capacity in Sales Intelligence.", fixAction: null };
  }
  return { ...base, status: "partial", evidence, missing: missing.length ? missing : ["At least two weeks of numbers for a fair average"], nextStep: "Add another week of numbers.", fixAction: "add_weekly_numbers" };
}

export function communicationDrafting(i: ReadinessInput): CapabilityResult {
  const base = { capability: "communication_drafting" as const };
  const named = i.opps.filter((o) => o.customer).length + i.invoices.filter((v) => v.customer).length;
  const perm = i.answers.customer_permission;
  const approval = i.answers.human_approval;
  if (named === 0) {
    return { ...base, status: "not_assessed", evidence: [], missing: ["Customer names in your sales or invoice records"], nextStep: "Import records that include customer names.", fixAction: "upload_sales" };
  }
  const evidence = [`${plural(named, "record")} include customer names`, "Every draft requires your review and approval in this app; nothing is sent automatically"];
  if (perm === "no") {
    return { ...base, status: "needs_setup", evidence, missing: ["You indicated you don't have permission to contact these customers"], nextStep: "Confirm permission to contact customers before drafting messages.", fixAction: "answer_privacy" };
  }
  if (perm !== "yes" || approval !== "yes") {
    return {
      ...base,
      status: "partial",
      evidence,
      missing: [perm !== "yes" ? "Confirm you have permission to contact these customers" : "Confirm who will review messages before they go out"],
      nextStep: "Answer two quick privacy questions.",
      fixAction: "answer_privacy",
    };
  }
  return { ...base, status: "ready", evidence: [...evidence, "You confirmed permission to contact customers and a person approves each message"], missing: [], nextStep: "Generate follow-up drafts from Sales or Financial Intelligence.", fixAction: null };
}

export function overdueInvoices(i: ReadinessInput): CapabilityResult {
  const base = { capability: "overdue_invoices" as const };
  const inv = i.invoices;
  if (inv.length === 0) {
    return { ...base, status: "not_assessed", evidence: [], missing: ["Invoice records (due date and amount still owed)"], nextStep: i.business.invoicing ? `Export your invoices from ${i.business.invoicing} and upload them.` : "Upload your invoice list.", fixAction: "upload_invoices" };
  }
  const withDue = inv.filter((v) => v.due_on).length;
  const withBalance = inv.filter((v) => v.amount_due != null).length;
  const totalOnly = inv.filter((v) => v.amount_due == null && v.total_amount != null).length;
  const evidence = [
    `${plural(inv.length, "invoice")} imported`,
    `Due dates on ${withDue} of ${inv.length} (${pct(withDue, inv.length)}%)`,
    `Amount still owed on ${withBalance} of ${inv.length} (${pct(withBalance, inv.length)}%)`,
  ];
  const missing: string[] = [];
  if (withDue < inv.length) missing.push(`${inv.length - withDue} invoices have no due date`);
  if (totalOnly) missing.push(`${totalOnly} invoices show a total but not the amount still owed (a total isn't the same as an unpaid balance)`);
  else if (withBalance < inv.length) missing.push(`${inv.length - withBalance} invoices have no balance`);
  if (isStale(i.lastUpdated.invoices, i.asOf)) missing.push(`Invoices haven't been updated in over ${STALE_DATA_DAYS} days`);
  if (withDue / inv.length >= 0.9 && withBalance / inv.length >= 0.9 && !isStale(i.lastUpdated.invoices, i.asOf)) {
    return { ...base, status: "ready", evidence, missing, nextStep: "Ask the Financial Agent which customers owe you money.", fixAction: null };
  }
  if (withBalance === 0) {
    return { ...base, status: "needs_setup", evidence, missing, nextStep: "Upload an invoice export that includes the Amount Due / Balance column.", fixAction: "fix_invoice_balances" };
  }
  return { ...base, status: "partial", evidence, missing, nextStep: "I can analyze the complete invoices now; fill in the rest for full coverage.", fixAction: "upload_invoices" };
}

export function expenseTrends(i: ReadinessInput): CapabilityResult {
  const base = { capability: "expense_trends" as const };
  const ex = i.expenses;
  if (ex.length === 0) {
    return { ...base, status: "not_assessed", evidence: [], missing: ["Dated expense records with amounts"], nextStep: "Upload your expense list (bank or accounting export).", fixAction: "upload_expenses" };
  }
  const current = monthKey(i.asOf);
  const usable = ex.filter((e) => e.spent_on && e.amount != null);
  const months = new Set(usable.map((e) => monthKey(e.spent_on!)).filter((m) => m < current));
  const uncategorized = usable.filter((e) => !e.category || !e.category.trim()).length;
  const evidence = [
    `${plural(ex.length, "expense")} imported`,
    `${usable.length} have a date and amount`,
    `${plural(months.size, "complete month")} covered`,
    `${new Set(usable.map((e) => (e.category ?? "").trim().toLowerCase()).filter(Boolean)).size} categories used`,
  ];
  const missing: string[] = [];
  if (usable.length < ex.length) missing.push(`${ex.length - usable.length} expenses are missing a date or amount`);
  if (uncategorized / Math.max(1, usable.length) > 0.2) missing.push(`${uncategorized} expenses have no category`);
  if (months.size >= 4 && missing.length === 0) {
    return { ...base, status: "ready", evidence, missing, nextStep: "Ask the Financial Agent why expenses are changing.", fixAction: null };
  }
  if (months.size >= 2) {
    return { ...base, status: "partial", evidence, missing: missing.length ? missing : ["More months of history make comparisons fairer (4+ recommended)"], nextStep: "Comparisons are possible; add more history or categories for better accuracy.", fixAction: "upload_expenses" };
  }
  return { ...base, status: "needs_setup", evidence, missing: [...missing, "Expenses from at least two complete months"], nextStep: "Upload expenses covering more months.", fixAction: "upload_expenses" };
}

export function cashFlow(i: ReadinessInput): CapabilityResult {
  const base = { capability: "cash_flow" as const };
  const res = calculateCashScenario({ cash: i.cash, invoices: i.invoices, expenses: i.expenses, asOf: i.asOf });
  const evidence: string[] = [];
  if (i.cash) evidence.push(`Cash on hand entered as of ${i.cash.as_of}`);
  if (i.invoices.length) evidence.push(`${plural(i.invoices.length, "invoice")} available for expected receipts`);
  if (i.expenses.length) evidence.push(`${plural(i.expenses.length, "expense")} available for upcoming costs`);
  if (res.available) {
    return { ...base, status: "ready", evidence, missing: [], nextStep: "Ask the Financial Agent for a 60-day cash scenario.", fixAction: null };
  }
  if (!i.cash && i.invoices.length === 0 && i.expenses.length === 0) {
    return { ...base, status: "not_assessed", evidence, missing: res.missing, nextStep: "Cash planning needs cash, invoice and expense information.", fixAction: "enter_cash" };
  }
  return {
    ...base,
    status: "needs_setup",
    evidence,
    missing: res.missing,
    nextStep: !i.cash ? "Enter your current cash on hand." : i.invoices.length === 0 ? "Upload invoices." : "Upload more expense history.",
    fixAction: !i.cash ? "enter_cash" : i.invoices.length === 0 ? "upload_invoices" : "upload_expenses",
  };
}

export const RULES: Record<CapabilityKey, (i: ReadinessInput) => CapabilityResult> = {
  sales_pipeline: salesPipeline,
  missed_followup: missedFollowup,
  sales_trends: salesTrends,
  appointment_capacity: appointmentCapacity,
  communication_drafting: communicationDrafting,
  overdue_invoices: overdueInvoices,
  expense_trends: expenseTrends,
  cash_flow: cashFlow,
};

export function assessAll(i: ReadinessInput): CapabilityResult[] {
  return CAPABILITIES.map((c) => RULES[c.key](i));
}

// ---- Five readiness areas (qualitative; based on answers + data) ----

export interface AreaSummary {
  area: "process" | "data" | "technology" | "people" | "privacy";
  label: string;
  known: string[];
  notVerified: string[];
  concerns: string[];
}

export function summarizeAreas(i: ReadinessInput, results: CapabilityResult[]): AreaSummary[] {
  const a = i.answers;
  const b = i.business;
  const process: AreaSummary = { area: "process", label: "How your business runs", known: [], notVerified: [], concerns: [] };
  if (b.sales_tracking) process.known.push(`Sales are tracked in ${b.sales_tracking}`);
  if (b.invoicing) process.known.push(`Invoices are handled in ${b.invoicing}`);
  if (b.biggest_challenge) process.known.push(`Biggest challenge: ${b.biggest_challenge}`);
  if (a.lead_sources) process.known.push(`Leads come from: ${a.lead_sources}`);
  else process.notVerified.push("How leads are received");
  if (a.followup_tracking) process.known.push(`Follow-ups tracked by: ${a.followup_tracking}`);
  else process.notVerified.push("How customer follow-ups are tracked");
  if (a.manual_tasks) process.known.push(`Manual work: ${a.manual_tasks}`);
  else process.notVerified.push("Which tasks are done by hand");

  const data: AreaSummary = { area: "data", label: "Your information", known: [], notVerified: [], concerns: [] };
  for (const r of results) {
    const label = CAPABILITIES.find((c) => c.key === r.capability)!.label;
    if (r.status === "ready") data.known.push(`${label}: required information verified`);
    else if (r.status === "not_assessed") data.notVerified.push(`${label}: no records yet`);
    else data.concerns.push(...r.missing.slice(0, 1).map((m) => `${label}: ${m}`));
  }

  const tech: AreaSummary = { area: "technology", label: "Your tools", known: [], notVerified: [], concerns: [] };
  const systems = a.systems ?? [];
  if (systems.length) tech.known.push(`Tools in use: ${systems.join(", ")}`);
  else tech.notVerified.push("Which tools you use day to day");
  if (b.data_path === "manual") tech.known.push("Paper records are fine to start; weekly numbers can be entered by hand");
  tech.known.push("No new software purchase is required to use these AI features");

  const people: AreaSummary = { area: "people", label: "People and routines", known: [], notVerified: [], concerns: [] };
  if (a.records_maintainer) people.known.push(`Records kept by: ${a.records_maintainer}`);
  else people.notVerified.push("Who maintains the records");
  if (a.reviewer) people.known.push(`AI suggestions reviewed by: ${a.reviewer}`);
  else people.notVerified.push("Who will review AI recommendations");
  if (a.update_frequency) people.known.push(`Records updated: ${a.update_frequency}`);
  else people.notVerified.push("How often records are updated");
  if (a.staff_tool_comfort === "low") people.concerns.push("Staff are not yet comfortable with the tools; start with one feature at a time");
  if (b.ai_experience) people.known.push(`AI experience: ${b.ai_experience}`);

  const privacy: AreaSummary = { area: "privacy", label: "Privacy and responsible use", known: [], notVerified: [], concerns: [] };
  if (a.customer_permission === "yes") privacy.known.push("You said you have permission to use customer contact information");
  else if (a.customer_permission === "no") privacy.concerns.push("You don't have permission to contact customers; drafting is limited");
  else privacy.notVerified.push("Permission to use customer information");
  if (a.financial_access) privacy.known.push(`Financial records access: ${a.financial_access}`);
  else privacy.notVerified.push("Who can see financial records");
  if (a.human_approval === "yes") privacy.known.push("A person approves every message before it goes out");
  else privacy.notVerified.push("Whether a person approves messages before sending");
  privacy.notVerified.push("A short questionnaire can't confirm security or legal compliance; these are your answers, not an audit");

  return [process, data, tech, people, privacy];
}
