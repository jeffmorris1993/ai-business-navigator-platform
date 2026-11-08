import Link from "next/link";
import { listFindings } from "@/lib/intelligence/findings";
import { db } from "@/lib/db/client";
import { FindingList, sortFindings } from "./findings";
import { SectionHeader } from "@/components/ui/card";
import { Mail, ArrowRight } from "lucide-react";

/** Top-of-page section on Sales / Finance: what this agent found and prepared. */
export async function AreaIntelligence({ businessId, agent, kind }: { businessId: string; agent: "sales" | "finance"; kind: "sales_followup" | "payment_reminder" }) {
  const [findings, drafts] = await Promise.all([
    listFindings(businessId, { open: true }),
    db().from("drafts").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("kind", kind).eq("status", "draft"),
  ]);
  const mine = sortFindings(findings.filter((f) => f.agent === agent || (f.agent === "software" && (agent === "sales" ? ["stale_opportunities", "stalled_proposals", "priority_opportunity"] : ["overdue_invoices", "customer_balance", "expense_increase"]).includes(f.category))));
  const label = agent === "sales" ? "Sales Agent" : "Financial Agent";
  return (
    <section className="mb-9">
      <SectionHeader
        title={`What your ${label} found`}
        description={mine.length ? "From the latest intelligence scans, re-verified against your records." : undefined}
        action={(drafts.count ?? 0) > 0 ? <Link href="/actions#drafts" className="inline-flex items-center gap-1 text-[13px] font-medium text-cobalt hover:underline"><Mail className="size-3.5" />{drafts.count} prepared {kind === "sales_followup" ? "follow-up" : "reminder"}{drafts.count === 1 ? "" : "s"} <ArrowRight className="size-3.5" /></Link> : undefined}
      />
      {mine.length ? <FindingList findings={mine} /> : (
        <div className="flex flex-col items-start justify-between gap-3 rounded-lg border border-dashed border-line-strong bg-surface/60 px-4 py-4 text-[13px] text-ink-3 sm:flex-row sm:items-center">
          <span>No open {agent === "sales" ? "sales" : "financial"} findings. Run a scan and the {label} will investigate the records below.</span>
          <Link href="/overview?scan=run" className="font-medium text-cobalt hover:underline">Run AI Intelligence Scan →</Link>
        </div>
      )}
    </section>
  );
}
