import { ownerPage } from "@/lib/page-auth";
import * as repo from "@/lib/db/repo";
import { getReadinessReport } from "@/lib/readiness/engine";
import { initialReport } from "@/lib/readiness/initial";
import { CAPABILITIES } from "@/lib/readiness/rules";
import { liveAiAvailable } from "@/lib/ai/openai";
import { samplesFor } from "@/lib/samples/catalog";
import { presetFor } from "@/lib/samples/presets";
import { PageHeader } from "@/components/app/status";
import { ReadinessView } from "@/components/app/readiness-view";

export const dynamic = "force-dynamic";

export default async function ReadinessPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { businessId } = await ownerPage();
  const sp = await searchParams;
  const [b, answers, report, opps, invoices, expenses, weeks] = await Promise.all([
    repo.getBusiness(businessId), repo.getAnswers(businessId), getReadinessReport(businessId),
    repo.listOpportunities(businessId), repo.listInvoices(businessId), repo.listExpenses(businessId), repo.listWeeks(businessId),
  ]);
  const initial = initialReport(b, answers, { opps: opps.length, invoices: invoices.length, expenses: expenses.length, weeks: weeks.length });
  const openMissing = opps.filter((o) => o.status === "open" && !o.last_contact_on).map((o) => ({ id: o.id, customer: o.customer, amount: o.amount, quoted_on: o.quoted_on, source_row: o.source_row, unknown: o.last_contact_unknown }));
  const unknownStatuses = [...new Set(opps.filter((o) => o.status === "unknown" && o.raw_status).map((o) => o.raw_status!))];
  const hasData = opps.length + invoices.length + expenses.length + weeks.length > 0;
  return (
    <>
      <PageHeader eyebrow="Guided activation" title="My AI Readiness" description="What AI can do for your business right now, based on your actual records, and what to do next. Each capability is checked separately with transparent rules." />
      <ReadinessView
        welcome={sp.welcome === "1"}
        businessName={b.name}
        capabilities={CAPABILITIES}
        report={report}
        initial={hasData ? null : initial}
        initialAlways={initial}
        openMissing={openMissing}
        unknownStatuses={unknownStatuses}
        answers={answers}
        liveAi={liveAiAvailable()}
        samples={{ sales: samplesFor(b.slug, "sales"), salesUpdate: samplesFor(b.slug, "salesUpdate"), invoices: samplesFor(b.slug, "invoices"), expenses: samplesFor(b.slug, "expenses") }}
        weeks={{ examples: presetFor(b.slug)?.weeks ?? [], entered: weeks.map((w) => w.week_start), companyName: b.name }}
      />
    </>
  );
}
