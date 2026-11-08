import "server-only";
import { db, must } from "../db/client";

// Sponsor reporting: aggregate counts only. No business names, customer names, amounts or record ids
// leave this function. Groups smaller than MIN_GROUP are suppressed.
export const MIN_GROUP = 3;

interface Row {
  business_ref: string; onboarded: boolean; industry: string | null; enrolled_at: string; ready_now: number; ready_at_start: number; assessed: boolean;
  used_sales_agent: boolean; used_finance_agent: boolean; tasks_total: number; tasks_done: number; quality_improvements: number; is_cohort_sim: boolean;
  scans_completed: number; findings_total: number; findings_verified_resolved: number; ai_prepared_actions: number; owner_approved_actions: number;
}

function weekStart(iso: string) {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

export async function sponsorMetrics(sponsorId: string, includeSimulated = true) {
  const sponsor = must(await db().from("sponsors").select("name,program_name,accent_color").eq("id", sponsorId).single(), "Sponsor") as { name: string; program_name: string; accent_color: string };
  let rows = must(await db().from("sponsor_business_progress").select("*").eq("sponsor_id", sponsorId), "Progress") as Row[];
  const simulatedCount = rows.filter((r) => r.is_cohort_sim).length;
  if (!includeSimulated) rows = rows.filter((r) => !r.is_cohort_sim);
  const n = rows.length;
  const pct = (x: number) => (n ? Math.round((x / n) * 100) : 0);
  const onboarded = rows.filter((r) => r.onboarded).length;
  const assessed = rows.filter((r) => r.assessed).length;
  const anyReady = rows.filter((r) => Number(r.ready_now) > 0).length;
  const improved = rows.filter((r) => Number(r.ready_now) > Number(r.ready_at_start)).length;
  const usedAgent = rows.filter((r) => r.used_sales_agent || r.used_finance_agent).length;
  const activated = rows.reduce((a, r) => a + Math.max(0, Number(r.ready_now) - Number(r.ready_at_start)), 0);
  const tasksTotal = rows.reduce((a, r) => a + Number(r.tasks_total), 0);
  const tasksDone = rows.reduce((a, r) => a + Number(r.tasks_done), 0);
  const avg = (k: "ready_now" | "ready_at_start") => (assessed ? Math.round((rows.filter((r) => r.assessed).reduce((a, r) => a + Number(r[k]), 0) / assessed) * 10) / 10 : 0);

  const industries = new Map<string, number>();
  rows.forEach((r) => industries.set(r.industry ?? "Not specified", (industries.get(r.industry ?? "Not specified") ?? 0) + 1));
  let suppressed = 0;
  const industryBreakdown = [...industries.entries()]
    .filter(([, c]) => (c >= MIN_GROUP ? true : ((suppressed += c), false)))
    .map(([industry, count]) => ({ industry, count }))
    .sort((a, b) => b.count - a.count);
  if (suppressed) industryBreakdown.push({ industry: `Other (groups under ${MIN_GROUP} combined)`, count: suppressed });

  // Weekly progress: counts of readiness improvements and capability activations (no identities).
  const ids = rows.map((r) => r.business_ref);
  const events = ids.length
    ? (must(await db().from("events").select("kind,created_at").in("business_id", ids).in("kind", ["record_quality_improved", "capability_activated", "task_completed"]), "Events") as Array<{ kind: string; created_at: string }>)
    : [];
  const weeks = new Map<string, { week: string; improvements: number; activations: number; tasksCompleted: number }>();
  rows.forEach((r) => {
    const w = weekStart(r.enrolled_at);
    if (!weeks.has(w)) weeks.set(w, { week: w, improvements: 0, activations: 0, tasksCompleted: 0 });
  });
  for (const e of events) {
    const w = weekStart(e.created_at);
    const row = weeks.get(w) ?? { week: w, improvements: 0, activations: 0, tasksCompleted: 0 };
    if (e.kind === "record_quality_improved") row.improvements += 1;
    if (e.kind === "capability_activated") row.activations += 1;
    if (e.kind === "task_completed") row.tasksCompleted += 1;
    weeks.set(w, row);
  }
  const enrolledByWeek = [...weeks.keys()].sort().map((w) => ({ ...weeks.get(w)!, enrolledToDate: rows.filter((r) => weekStart(r.enrolled_at) <= w).length }));

  return {
    sponsor,
    includesSimulated: includeSimulated,
    simulatedCount,
    totals: {
      enrolled: n, onboarded, assessed, withReadyCapability: anyReady, improvedReadiness: improved, usedAnAgent: usedAgent,
      salesAgentAdoption: rows.filter((r) => r.used_sales_agent).length, financeAgentAdoption: rows.filter((r) => r.used_finance_agent).length,
      capabilitiesActivated: activated, tasksTotal, tasksDone, taskCompletionRate: tasksTotal ? Math.round((tasksDone / tasksTotal) * 100) : 0,
      avgReadyAtStart: avg("ready_at_start"), avgReadyNow: avg("ready_now"), qualityImprovements: rows.reduce((a, r) => a + Number(r.quality_improvements), 0),
    },
    ai: {
      businessesScanned: rows.filter((r) => Number(r.scans_completed) > 0).length,
      scansCompleted: rows.reduce((a, r) => a + Number(r.scans_completed), 0),
      findingsSurfaced: rows.reduce((a, r) => a + Number(r.findings_total), 0),
      aiPreparedActions: rows.reduce((a, r) => a + Number(r.ai_prepared_actions), 0),
      ownerApprovedActions: rows.reduce((a, r) => a + Number(r.owner_approved_actions), 0),
      verifiedOutcomes: rows.reduce((a, r) => a + Number(r.findings_verified_resolved), 0),
    },
    funnel: [
      { stage: "Enrolled", count: n, pct: 100 },
      { stage: "Completed onboarding", count: onboarded, pct: pct(onboarded) },
      { stage: "Readiness assessed", count: assessed, pct: pct(assessed) },
      { stage: "At least one AI capability ready", count: anyReady, pct: pct(anyReady) },
      { stage: "Improved readiness", count: improved, pct: pct(improved) },
      { stage: "Used an AI agent", count: usedAgent, pct: pct(usedAgent) },
    ],
    industryBreakdown,
    weekly: enrolledByWeek,
    privacy: `Counts only. No business names, customer details, invoices or dollar amounts are shared with sponsors. Groups smaller than ${MIN_GROUP} are combined.`,
  };
}
