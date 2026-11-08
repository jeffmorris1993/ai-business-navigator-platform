import Link from "next/link";
import { ownerPage } from "@/lib/page-auth";
import { db } from "@/lib/db/client";
import { loadActivity } from "@/lib/intelligence/activity";
import { PageHeader, AGENT_META, AgentGlyph, EmptyState } from "@/components/app/status";
import { SectionHeader } from "@/components/ui/card";
import { ActivityTimeline, timeAgo } from "@/components/app/activity-timeline";
import { Brain, Cpu, CheckCircle2, XCircle, Loader2, Activity as ActivityIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TRIGGER: Record<string, string> = { manual: "Started by you", import: "Automatic, after an import", follow_up: "Follow-up scan", software_only: "Software checks only (no AI)" };

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ scan?: string; run?: string }> }) {
  const { businessId } = await ownerPage();
  const sp = await searchParams;
  const [scans, timeline] = await Promise.all([
    db().from("intelligence_scans").select("*").eq("business_id", businessId).order("started_at", { ascending: false }).limit(20),
    loadActivity(businessId, 30),
  ]);
  const selectedScan = sp.scan ?? (sp.run ? null : scans.data?.[0]?.id ?? null);
  const runs = selectedScan
    ? (await db().from("agent_runs").select("id,agent,question,answer,status,error,model,started_at,finished_at,parent_run_id").eq("business_id", businessId).eq("scan_id", selectedScan).order("started_at")).data ?? []
    : sp.run ? (await db().from("agent_runs").select("id,agent,question,answer,status,error,model,started_at,finished_at,parent_run_id").eq("business_id", businessId).eq("id", sp.run)).data ?? [] : [];
  const steps = runs.length ? (await db().from("agent_steps").select("run_id,step_no,kind,tool,output_summary,ok,duration_ms").in("run_id", runs.map((r) => r.id)).order("step_no")).data ?? [] : [];
  const scan = scans.data?.find((s) => s.id === selectedScan);

  return (
    <>
      <PageHeader eyebrow="Evidence trail" title="Agent Activity" description="What your agents actually did: which agent ran, what started it, which tools it used, what it found and prepared, and whether it succeeded. Concise summaries only; private model reasoning isn't shown." />
      <div className="grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="space-y-6">
          <section>
            <SectionHeader title="Scans" />
            {scans.data?.length ? (
              <ul className="overflow-hidden rounded-lg border border-line bg-surface shadow-card">
                {scans.data.map((s) => (
                  <li key={s.id} className="border-b border-line last:border-0">
                    <Link href={`/activity?scan=${s.id}`} className={cn("block px-3.5 py-2.5 hover:bg-subtle/60", s.id === selectedScan && "bg-cobalt-50/60")}>
                      <div className="flex items-center gap-1.5 text-[13px] font-medium">
                        {s.status === "completed" ? <CheckCircle2 className="size-3.5 text-teal" /> : s.status === "running" ? <Loader2 className="size-3.5 animate-spin text-cobalt" /> : <XCircle className="size-3.5 text-red" />}
                        {TRIGGER[s.trigger] ?? s.trigger}
                      </div>
                      <div className="mt-0.5 text-[11.5px] text-ink-3">{timeAgo(s.started_at)} · {s.findings_new} new · {s.findings_updated} updated · {s.findings_resolved} resolved</div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <EmptyState icon={<ActivityIcon className="size-6" />} title="No scans yet" />}
          </section>
          <section>
            <SectionHeader title="Timeline" />
            <div className="rounded-lg border border-line bg-surface p-4 shadow-card"><ActivityTimeline items={timeline} /></div>
          </section>
        </div>

        <div className="min-w-0">
          {scan && (
            <div className="mb-5 rounded-lg border border-line bg-surface p-5 shadow-card">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
                <span className={cn("font-medium", scan.status === "completed" ? "text-teal-700" : scan.status === "failed" ? "text-red-700" : "text-cobalt-700")}>{scan.status === "completed" ? "Completed" : scan.status === "failed" ? "Did not finish" : "Running"}</span>
                <span>{TRIGGER[scan.trigger]}</span>
                <span>{new Date(scan.started_at).toLocaleString()}</span>
                {scan.finished_at && <span>{Math.round((new Date(scan.finished_at).getTime() - new Date(scan.started_at).getTime()) / 1000)}s</span>}
                {scan.model && <span className="font-mono">{scan.model}</span>}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[["New findings", scan.findings_new], ["Updated", scan.findings_updated], ["Resolved", scan.findings_resolved], ["Drafts", scan.drafts_prepared], ["Tasks", scan.tasks_created]].map(([l, v]) => (
                  <div key={l as string}><div className="text-[12px] text-ink-3">{l}</div><div className="tnum mt-1 text-[26px] font-semibold leading-none tracking-[-0.03em]">{v}</div></div>
                ))}
              </div>
              {scan.summary && <p className="mt-3 border-t border-line pt-3 text-[13.5px] leading-relaxed text-ink-2">{scan.summary}</p>}
              {scan.error && <p className="mt-3 rounded bg-red-50 px-3 py-2 text-[13px] text-red-700">{scan.error} Findings saved before it stopped are kept and labeled with this scan.</p>}
            </div>
          )}
          {runs.length ? (
            <div className="space-y-4">
              {runs.map((r) => {
                const m = AGENT_META[r.agent] ?? AGENT_META.advisor;
                const rs = steps.filter((s) => s.run_id === r.id);
                return (
                  <section key={r.id} className={cn("rounded-lg border border-line bg-surface shadow-card", r.parent_run_id && "ml-0 sm:ml-6")}>
                    <div className="flex flex-wrap items-center gap-2.5 border-b border-line px-4 py-3">
                      <AgentGlyph agent={r.agent} size={22} />
                      <span className="text-[14px] font-medium">{m.label}</span>
                      {r.parent_run_id && <span className="text-xs text-ink-3">dispatched by the Intelligence Engine</span>}
                      <span className="ml-auto text-xs text-ink-3">{rs.filter((s) => s.kind === "model_call").length} AI decisions · {rs.filter((s) => s.kind === "tool_call").length} tool runs · {r.status}</span>
                    </div>
                    {r.parent_run_id && <p className="border-b border-line bg-subtle/50 px-4 py-2 text-[12px] text-ink-2"><span className="font-medium">Assignment: </span>{String(r.question).replace(/^Investigate: /, "")}</p>}
                    <ol className="space-y-1.5 px-4 py-3">
                      {rs.map((s) => (
                        <li key={s.step_no} className="flex gap-2 text-[12.5px] leading-snug">
                          {s.kind === "model_call" ? <Brain className="mt-[2px] size-3.5 shrink-0 text-cobalt" /> : s.ok ? <Cpu className="mt-[2px] size-3.5 shrink-0 text-ink-4" /> : <XCircle className="mt-[2px] size-3.5 shrink-0 text-amber" />}
                          <span className={s.kind === "model_call" ? "text-cobalt-700" : s.ok ? "text-ink-2" : "text-amber-700"}>{s.output_summary}{s.tool && <span className="ml-1.5 font-mono text-[10.5px] text-ink-4">{s.tool}</span>}</span>
                        </li>
                      ))}
                    </ol>
                    {r.answer && <p className="border-t border-line px-4 py-2.5 text-[12.5px] leading-relaxed text-ink-3"><span className="font-medium text-ink-2">Report: </span>{r.answer}</p>}
                  </section>
                );
              })}
            </div>
          ) : <EmptyState title="Select a scan">Pick a scan on the left to see each agent&apos;s actions.</EmptyState>}
        </div>
      </div>
    </>
  );
}
