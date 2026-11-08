import { addDays, daysBetween, monthKey } from "./dates";
import { sumMoney, toCents, fromCents } from "./money";
import type { Invoice, Expense, CashPosition } from "../types";

export type AgingBucket = "1-30" | "31-60" | "61-90" | "90+";

function bucket(days: number): AgingBucket {
  if (days <= 30) return "1-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

export interface OverdueInvoice {
  id: string;
  invoice_no: string | null;
  customer: string | null;
  due_on: string;
  amount_due: number;
  total_amount: number | null;
  days_overdue: number;
  bucket: AgingBucket;
  source_file_id: string | null;
  source_row: number | null;
}

/**
 * Overdue = an unpaid balance (amount_due > 0) whose due date has passed.
 * Total Amount is never used as a balance. Invoices missing a due date or balance
 * are excluded and listed so the owner can fix them.
 */
export function findOverdueInvoices(invoices: Invoice[], asOf: string) {
  const overdue: OverdueInvoice[] = [];
  const missingDueDate: Array<{ id: string; invoice_no: string | null; customer: string | null }> = [];
  const missingBalance: Array<{ id: string; invoice_no: string | null; customer: string | null; total_amount: number | null }> = [];
  for (const inv of invoices) {
    if (inv.amount_due == null) {
      missingBalance.push({ id: inv.id, invoice_no: inv.invoice_no, customer: inv.customer, total_amount: inv.total_amount });
      continue;
    }
    if (inv.amount_due <= 0) continue;
    if (!inv.due_on) {
      missingDueDate.push({ id: inv.id, invoice_no: inv.invoice_no, customer: inv.customer });
      continue;
    }
    const days = daysBetween(inv.due_on, asOf);
    if (days <= 0) continue;
    overdue.push({
      id: inv.id,
      invoice_no: inv.invoice_no,
      customer: inv.customer,
      due_on: inv.due_on,
      amount_due: inv.amount_due,
      total_amount: inv.total_amount,
      days_overdue: days,
      bucket: bucket(days),
      source_file_id: inv.source_file_id,
      source_row: inv.source_row,
    });
  }
  overdue.sort((a, b) => b.days_overdue - a.days_overdue || b.amount_due - a.amount_due);
  const byBucket: Record<AgingBucket, { count: number; total: number }> = {
    "1-30": { count: 0, total: 0 },
    "31-60": { count: 0, total: 0 },
    "61-90": { count: 0, total: 0 },
    "90+": { count: 0, total: 0 },
  };
  for (const o of overdue) {
    byBucket[o.bucket].count += 1;
    byBucket[o.bucket].total = sumMoney([byBucket[o.bucket].total, o.amount_due]);
  }
  const byCustomer = new Map<string, { customer: string; count: number; total: number; oldestDays: number }>();
  for (const o of overdue) {
    const k = o.customer ?? "(no name)";
    const c = byCustomer.get(k) ?? { customer: k, count: 0, total: 0, oldestDays: 0 };
    c.count += 1;
    c.total = sumMoney([c.total, o.amount_due]);
    c.oldestDays = Math.max(c.oldestDays, o.days_overdue);
    byCustomer.set(k, c);
  }
  return {
    asOf,
    count: overdue.length,
    total: sumMoney(overdue.map((o) => o.amount_due)),
    overdue,
    byBucket,
    byCustomer: [...byCustomer.values()].sort((a, b) => b.total - a.total),
    missingDueDate,
    missingBalance,
  };
}

export function outstandingBalances(invoices: Invoice[], asOf: string) {
  const open = invoices.filter((i) => (i.amount_due ?? 0) > 0);
  const notYetDue = open.filter((i) => i.due_on && daysBetween(i.due_on, asOf) <= 0);
  const overdue = findOverdueInvoices(invoices, asOf);
  return {
    openCount: open.length,
    totalOutstanding: sumMoney(open.map((i) => i.amount_due)),
    notYetDueCount: notYetDue.length,
    notYetDueTotal: sumMoney(notYetDue.map((i) => i.amount_due)),
    overdueCount: overdue.count,
    overdueTotal: overdue.total,
  };
}

/** Apply a payment to an invoice balance. Throws on invalid input; never lets balance go negative silently. */
export function applyPayment(amountDue: number, payment: number): { newBalance: number; overpayment: number } {
  if (!(payment > 0)) throw new Error("Payment must be greater than zero.");
  const due = toCents(amountDue);
  const pay = toCents(payment);
  if (pay > due) return { newBalance: 0, overpayment: fromCents(pay - due) };
  return { newBalance: fromCents(due - pay), overpayment: 0 };
}

export function expensesByMonth(expenses: Expense[]) {
  const months = new Map<string, Map<string, number>>();
  for (const e of expenses) {
    if (!e.spent_on || e.amount == null) continue;
    const m = monthKey(e.spent_on);
    const cat = normalizeCategory(e.category);
    const row = months.get(m) ?? new Map<string, number>();
    row.set(cat, sumMoney([row.get(cat) ?? 0, e.amount]));
    months.set(m, row);
  }
  return [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, cats]) => ({ month, total: sumMoney([...cats.values()]), byCategory: Object.fromEntries(cats) }));
}

export function normalizeCategory(c: string | null): string {
  if (!c || !c.trim()) return "Uncategorized";
  const s = c.trim().toLowerCase().replace(/\s+/g, " ");
  return s.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

/**
 * Compare the most recent N complete months with the N months before them.
 * The current (partial) month is excluded so it doesn't look like a drop.
 */
export function analyzeExpenses(expenses: Expense[], asOf: string, windowMonths = 3) {
  const currentMonth = monthKey(asOf);
  const monthly = expensesByMonth(expenses).filter((m) => m.month < currentMonth);
  const undated = expenses.filter((e) => !e.spent_on || e.amount == null).length;
  if (monthly.length < 2) {
    return {
      sufficient: false as const,
      reason: "Need dated expenses in at least two complete months to compare.",
      monthly,
      undated,
    };
  }
  const w = Math.min(windowMonths, Math.floor(monthly.length / 2));
  const recent = monthly.slice(-w);
  const prior = monthly.slice(-2 * w, -w);
  const cats = new Set<string>();
  for (const m of [...recent, ...prior]) Object.keys(m.byCategory).forEach((c) => cats.add(c));
  const avg = (rows: typeof monthly, cat?: string) =>
    fromCents(Math.round(rows.reduce((a, r) => a + toCents(cat ? r.byCategory[cat] ?? 0 : r.total), 0) / rows.length));
  const categories = [...cats]
    .map((cat) => {
      const before = avg(prior, cat);
      const after = avg(recent, cat);
      return {
        category: cat,
        priorMonthlyAvg: before,
        recentMonthlyAvg: after,
        change: fromCents(toCents(after) - toCents(before)),
        changePct: before ? Math.round(((after - before) / before) * 1000) / 10 : null,
      };
    })
    .sort((a, b) => b.change - a.change);
  const priorAvg = avg(prior);
  const recentAvg = avg(recent);
  return {
    sufficient: true as const,
    windowMonths: w,
    recentPeriod: `${recent[0].month} to ${recent[recent.length - 1].month}`,
    priorPeriod: `${prior[0].month} to ${prior[prior.length - 1].month}`,
    priorMonthlyAvg: priorAvg,
    recentMonthlyAvg: recentAvg,
    totalChangePct: priorAvg ? Math.round(((recentAvg - priorAvg) / priorAvg) * 1000) / 10 : null,
    categories,
    monthly,
    undated,
  };
}

export function financialSummary(invoices: Invoice[], expenses: Expense[], asOf: string) {
  const billedByMonth = new Map<string, number>();
  for (const i of invoices) {
    if (!i.issued_on || i.total_amount == null) continue;
    const m = monthKey(i.issued_on);
    billedByMonth.set(m, sumMoney([billedByMonth.get(m) ?? 0, i.total_amount]));
  }
  const exp = expensesByMonth(expenses);
  const months = new Set([...billedByMonth.keys(), ...exp.map((e) => e.month)]);
  const rows = [...months].sort().map((m) => {
    const billed = billedByMonth.get(m) ?? null;
    const spent = exp.find((e) => e.month === m)?.total ?? null;
    return { month: m, billed, expenses: spent, difference: billed != null && spent != null ? sumMoney([billed, -spent]) : null };
  });
  return {
    asOf,
    months: rows,
    balances: outstandingBalances(invoices, asOf),
    note: "\"Billed\" is invoice totals by issue date, not cash received.",
  };
}

export interface CashScenarioInput {
  cash: CashPosition | null;
  invoices: Invoice[];
  expenses: Expense[];
  asOf: string;
  horizonDays?: number;
}

/**
 * Simple cash scenario. Refuses (available=false) and lists what's missing when
 * starting cash, receivables with due dates, or enough expense history are absent.
 */
export function calculateCashScenario({ cash, invoices, expenses, asOf, horizonDays = 60 }: CashScenarioInput) {
  const missing: string[] = [];
  if (!cash) missing.push("Your current cash on hand (bank balance) and the date it was checked");
  const receivables = invoices.filter((i) => (i.amount_due ?? 0) > 0 && i.due_on);
  const undatedReceivables = invoices.filter((i) => (i.amount_due ?? 0) > 0 && !i.due_on).length;
  if (invoices.length === 0) missing.push("Invoices with due dates and unpaid balances (money you expect to receive)");
  const monthly = expensesByMonth(expenses).filter((m) => m.month < monthKey(asOf));
  if (monthly.length < 2) missing.push("At least two complete months of dated expenses (to estimate upcoming costs)");
  if (missing.length) return { available: false as const, missing };

  const avgMonthlyExpense = fromCents(Math.round(monthly.slice(-3).reduce((a, m) => a + toCents(m.total), 0) / Math.min(3, monthly.length)));
  const end = addDays(asOf, horizonDays);
  const dueInWindow = receivables.filter((i) => i.due_on! <= end);
  const notOverdue = dueInWindow.filter((i) => i.due_on! >= asOf);
  const expectedExpenses = fromCents(Math.round(toCents(avgMonthlyExpense) * (horizonDays / 30)));
  const start = cash!.cash_on_hand;
  const allCollected = sumMoney(dueInWindow.map((i) => i.amount_due));
  const onTimeOnly = sumMoney(notOverdue.map((i) => i.amount_due));
  return {
    available: true as const,
    horizonDays,
    startingCash: start,
    cashAsOf: cash!.as_of,
    avgMonthlyExpense,
    expectedExpenses,
    scenarios: [
      {
        name: "If every invoice due in this window is paid (including overdue ones)",
        receipts: allCollected,
        endingCash: sumMoney([start, allCollected, -expectedExpenses]),
      },
      {
        name: "If overdue invoices stay unpaid",
        receipts: onTimeOnly,
        endingCash: sumMoney([start, onTimeOnly, -expectedExpenses]),
      },
      {
        name: "If no invoices are collected",
        receipts: 0,
        endingCash: sumMoney([start, -expectedExpenses]),
      },
    ],
    assumptions: [
      `Upcoming expenses estimated from your average of the last ${Math.min(3, monthly.length)} complete months.`,
      "Receipts are counted on invoice due dates; real payment timing varies.",
      undatedReceivables ? `${undatedReceivables} unpaid invoice(s) have no due date and were left out.` : null,
      "This is a planning scenario, not financial advice or a guarantee.",
    ].filter(Boolean),
  };
}
