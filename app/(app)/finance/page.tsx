import { ownerPage } from "@/lib/page-auth";
import * as repo from "@/lib/db/repo";
import { loadReadinessInput } from "@/lib/readiness/engine";
import { RULES } from "@/lib/readiness/rules";
import { findOverdueInvoices, outstandingBalances, analyzeExpenses, calculateCashScenario } from "@/lib/calc/finance";
import { demoToday } from "@/lib/calc/dates";
import { formatMoney } from "@/lib/calc/money";
import { liveAiAvailable } from "@/lib/ai/openai";
import { samplesFor } from "@/lib/samples/catalog";
import { PageHeader, Stat, StatusPill } from "@/components/app/status";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AgentChat } from "@/components/app/agent-chat";
import { OverdueTable } from "@/components/app/overdue-table";
import { AgingChart, ExpenseChart } from "@/components/app/charts";
import { Importer } from "@/components/app/importer";
import { CashForm } from "@/components/app/forms";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const { businessId } = await ownerPage();
  const [input, b, files] = await Promise.all([loadReadinessInput(businessId), repo.getBusiness(businessId), repo.listSourceFiles(businessId)]);
  const fileName = Object.fromEntries(files.map((f) => [f.id, f.filename]));
  const today = demoToday();
  const st = { overdue: RULES.overdue_invoices(input), expenses: RULES.expense_trends(input), cash: RULES.cash_flow(input) };
  const usable = (s: { status: string }) => s.status === "ready" || s.status === "partial";
  const overdue = usable(st.overdue) ? findOverdueInvoices(input.invoices, today) : null;
  const balances = input.invoices.length ? outstandingBalances(input.invoices, today) : null;
  const expenses = usable(st.expenses) ? analyzeExpenses(input.expenses, today) : null;
  const cash = calculateCashScenario({ cash: input.cash, invoices: input.invoices, expenses: input.expenses, asOf: today });
  const live = liveAiAvailable();

  return (
    <>
      <PageHeader title="Financial Intelligence" description="Invoices, payments and expenses, analyzed with exact calculations. The Financial Agent explains results and suggests actions; it is not a licensed financial professional.">
        <div className="flex flex-wrap gap-1.5"><StatusPill status={st.overdue.status} /><StatusPill status={st.expenses.status} /></div>
      </PageHeader>

      {balances && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Overdue" value={overdue ? formatMoney(overdue.total, { cents: true }) : "—"} sub={overdue ? `${overdue.count} invoices past due` : st.overdue.missing[0]} tone="red" />
          <Stat label="Total still owed to you" value={formatMoney(balances.totalOutstanding, { cents: true })} sub={`${balances.openCount} unpaid invoices`} />
          <Stat label="Not yet due" value={formatMoney(balances.notYetDueTotal, { cents: true })} sub={`${balances.notYetDueCount} invoices`} tone="green" />
          <Stat label="Oldest overdue" value={overdue?.overdue[0] ? `${overdue.overdue[0].days_overdue} days` : "—"} sub={overdue?.overdue[0]?.customer ?? ""} tone="amber" />
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div><CardTitle>Overdue invoices</CardTitle><CardDescription>Unpaid balances past their due date, oldest first. Calculated from the &quot;amount still owed&quot;, never the invoice total.</CardDescription></div>
            <StatusPill status={st.overdue.status} />
          </div>
        </CardHeader>
        <CardContent>
          {overdue ? (
            overdue.count ? (
              <div className="space-y-5">
                <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
                  <AgingChart buckets={overdue.byBucket} />
                  <div className="rounded-xl bg-slate-50 p-4 text-sm">
                    <div className="mb-2 font-medium">By customer</div>
                    <ul className="space-y-1.5">{overdue.byCustomer.slice(0, 6).map((c) => <li key={c.customer} className="flex justify-between gap-2"><span className="truncate">{c.customer}</span><span className="font-medium">{formatMoney(c.total, { cents: true })}</span></li>)}</ul>
                  </div>
                </div>
                <OverdueTable rows={overdue.overdue.map((o) => ({ ...o, source: o.source_file_id ? `${fileName[o.source_file_id] ?? "file"}, row ${o.source_row}` : null }))} today={today} />
                {(overdue.missingDueDate.length > 0 || overdue.missingBalance.length > 0) && <p className="text-xs text-slate-500">{overdue.missingDueDate.length} invoice(s) without due dates and {overdue.missingBalance.length} without balances were left out.</p>}
              </div>
            ) : <p className="text-sm text-emerald-700">No overdue invoices. Nice work.</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-900"><b>{st.overdue.status === "not_assessed" ? "Not assessed yet." : "Needs setup."}</b> {st.overdue.missing.join(". ")}. {st.overdue.nextStep}</div>
              <Importer samples={samplesFor(b.slug, "invoices")} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle>Financial Agent</CardTitle><CardDescription>Ask about money owed, costs or cash. It uses the same exact calculations and shows every step.</CardDescription></CardHeader>
        <CardContent>
          <AgentChat agent="finance" liveAi={live} suggestions={["Which customers owe me money, and what should I do?", "Why are my expenses increasing?", "Give me a 60-day cash-flow forecast.", "Draft reminders for invoices more than 30 days overdue"]} />
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3"><div><CardTitle>Expense trends</CardTitle><CardDescription>{expenses?.sufficient ? `Monthly average ${expenses.priorPeriod} vs ${expenses.recentPeriod}` : "Compare spending across months by category."}</CardDescription></div><StatusPill status={st.expenses.status} /></div>
          </CardHeader>
          <CardContent>
            {expenses?.sufficient ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-slate-50 p-3 text-sm">Average monthly spending went from <b>{formatMoney(expenses.priorMonthlyAvg)}</b> to <b>{formatMoney(expenses.recentMonthlyAvg)}</b> ({expenses.totalChangePct! > 0 ? "+" : ""}{expenses.totalChangePct}%).</div>
                <ExpenseChart monthly={expenses.monthly} />
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-1">Category</th><th className="py-1 text-right">Before</th><th className="py-1 text-right">Recent</th><th className="py-1 text-right">Change</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {expenses.categories.map((c) => (
                      <tr key={c.category}><td className="py-1.5">{c.category}</td><td className="py-1.5 text-right">{formatMoney(c.priorMonthlyAvg)}</td><td className="py-1.5 text-right">{formatMoney(c.recentMonthlyAvg)}</td><td className={`py-1.5 text-right font-medium ${c.change > 0 ? "text-rose-600" : c.change < 0 ? "text-emerald-600" : "text-slate-500"}`}>{c.changePct != null ? `${c.changePct > 0 ? "+" : ""}${c.changePct}%` : "new"}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">{st.expenses.missing[0] ?? "Upload expenses to compare periods."}</p>
                <Importer samples={samplesFor(b.slug, "expenses")} compact />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3"><div><CardTitle>Cash-flow scenarios</CardTitle><CardDescription>Next 60 days under three what-ifs. Planning aid, not a guarantee.</CardDescription></div><StatusPill status={st.cash.status} /></div>
          </CardHeader>
          <CardContent>
            {cash.available ? (
              <div className="space-y-3">
                <div className="text-sm text-slate-600">Starting cash <b>{formatMoney(cash.startingCash)}</b> (as of {cash.cashAsOf}); expected expenses <b>{formatMoney(cash.expectedExpenses)}</b>.</div>
                {cash.scenarios.map((s) => (
                  <div key={s.name} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm">
                    <span className="text-slate-700">{s.name}<span className="block text-xs text-slate-500">Receipts {formatMoney(s.receipts)}</span></span>
                    <span className={`text-base font-semibold ${s.endingCash < 0 ? "text-rose-600" : "text-ink"}`}>{formatMoney(s.endingCash)}</span>
                  </div>
                ))}
                <ul className="list-disc space-y-0.5 pl-5 text-xs text-slate-500">{cash.assumptions.map((a) => <li key={String(a)}>{a}</li>)}</ul>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                  <b>I can&apos;t build a cash forecast yet.</b> I&apos;d need:
                  <ul className="mt-1 list-disc pl-5">{cash.missing.map((m) => <li key={m}>{m}</li>)}</ul>
                </div>
                {!input.cash && <CashForm />}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
