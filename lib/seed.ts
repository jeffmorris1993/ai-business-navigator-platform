import "server-only";
import Papa from "papaparse";
import { db, must } from "./db/client";
import * as S from "./samples/data";
import { heuristicMapping } from "./import/heuristics";
import { importRowsDirect } from "./services/imports";
import { runAssessment } from "./readiness/engine";
import { saveAnswers } from "./db/repo";
import type { ConfirmedMapping } from "./import/types";
import type { RecordType } from "./import/schemas";
import { CAPABILITIES } from "./readiness/rules";

// FICTIONAL SAMPLE DATA ONLY. Sponsors and businesses are invented; no real organization is represented.

export const SPONSORS = [
  { slug: "northstar", name: "Northstar Connect (fictional)", program_name: "Northstar Small Business AI Program", accent_color: "#2563eb" },
  { slug: "harborline", name: "Harborline Community Bank (fictional)", program_name: "Main Street AI Initiative", accent_color: "#0f766e" },
];

type SampleSlug = "metro-roofing" | "brightpath-consulting" | "freshstart-cleaning" | "beauty-lounge" | "neighborhood-kitchen";

const BUSINESSES: Record<SampleSlug, Record<string, unknown>> = {
  "metro-roofing": {
    name: "Metro Roofing", industry: "Roofing and construction", sales_tracking: "Excel spreadsheets", invoicing: "QuickBooks",
    biggest_challenge: "Following up with customers", ai_experience: "Beginner", main_goal: "Increase sales without hiring another administrator", data_path: "spreadsheet", onboarded: true,
  },
  "brightpath-consulting": {
    name: "BrightPath Consulting", industry: "Professional services consulting", sales_tracking: "Google Sheets", invoicing: "FreshBooks",
    biggest_challenge: "Proposals go quiet after we send them", ai_experience: "Some experience", main_goal: "Close more proposals and get paid faster", data_path: "spreadsheet", onboarded: true,
  },
  "freshstart-cleaning": {
    name: "FreshStart Cleaning", industry: "Commercial cleaning", sales_tracking: "Word of mouth, no tracking", invoicing: "QuickBooks",
    biggest_challenge: "Clients paying late", ai_experience: "Beginner", main_goal: "Improve cash flow", data_path: "spreadsheet", onboarded: true,
  },
  "beauty-lounge": {
    name: "The Beauty Lounge", industry: "Salon", sales_tracking: "Paper appointment book", invoicing: "Card reader, no invoices",
    biggest_challenge: "Empty chairs on weekdays", ai_experience: "Beginner", main_goal: "Fill more appointment slots", data_path: "manual", onboarded: true,
  },
  "neighborhood-kitchen": {
    name: "Neighborhood Kitchen", industry: "Restaurant", sales_tracking: "POS system", invoicing: "Not applicable",
    biggest_challenge: "Food costs keep going up", ai_experience: "Beginner", main_goal: "Protect profit margins", data_path: "spreadsheet", onboarded: true,
  },
};

const ANSWERS: Partial<Record<SampleSlug, Record<string, unknown>>> = {
  "metro-roofing": { lead_sources: "Phone calls and website form", estimate_process: "Owner measures the roof and writes the bid in Excel", followup_tracking: "Last Call column in the estimates sheet", manual_tasks: "Calling back homeowners, chasing invoices", records_maintainer: "Owner", reviewer: "Owner", update_frequency: "Weekly", staff_tool_comfort: "medium", customer_permission: "yes", human_approval: "yes", financial_access: "Owner and bookkeeper", systems: ["spreadsheets", "accounting", "email"] },
  "brightpath-consulting": { lead_sources: "Referrals and LinkedIn", followup_tracking: "Last Email column in the proposal sheet", records_maintainer: "Office manager", reviewer: "Managing partner", update_frequency: "Weekly", customer_permission: "yes", human_approval: "yes", financial_access: "Partners and bookkeeper", systems: ["spreadsheets", "email", "accounting"], staff_tool_comfort: "high" },
  "freshstart-cleaning": { records_maintainer: "Owner", reviewer: "Owner", update_frequency: "Monthly", customer_permission: "yes", human_approval: "yes", financial_access: "Owner and bookkeeper", systems: ["accounting", "email"], staff_tool_comfort: "medium" },
  "beauty-lounge": { lead_sources: "Walk-ins and Instagram", followup_tracking: "Not tracked", records_maintainer: "Front desk", reviewer: "Owner", update_frequency: "Weekly totals on Sunday", systems: ["paper", "appointments"], staff_tool_comfort: "low", customer_permission: "unsure" },
  "neighborhood-kitchen": { records_maintainer: "General manager", reviewer: "Owner", update_frequency: "Weekly", systems: ["pos", "spreadsheets", "accounting"], financial_access: "Owner and GM", staff_tool_comfort: "medium" },
};

function mappingFor(rows: Record<string, unknown>[], type: RecordType, statusOverrides: Record<string, string> = {}): ConfirmedMapping {
  const s = heuristicMapping(Object.keys(rows[0]), rows, type);
  const statusMap: Record<string, string> = {};
  s.statusValues.forEach((v) => v.suggested && (statusMap[v.raw] = v.suggested));
  return { recordType: type, columns: Object.fromEntries(s.columns.map((c) => [c.header, c.field])), statusMap: { ...statusMap, ...statusOverrides } };
}

async function load(businessId: string, filename: string, rows: Record<string, unknown>[], type: RecordType, statusOverrides: Record<string, string> = {}) {
  await importRowsDirect(businessId, filename, rows, mappingFor(rows, type, statusOverrides), Buffer.from(Papa.unparse(rows)));
}

async function clearBusinessData(businessId: string) {
  const tables = ["agent_steps", "pending_actions", "drafts", "tasks", "findings", "agent_runs", "intelligence_scans", "conversations", "capability_status", "readiness_assessments", "payments", "invoices", "sales_opportunities", "expenses", "appointments", "manual_weekly_entries", "cash_positions", "column_mappings", "events", "business_profile_answers"];
  for (const t of tables) await db().from(t).delete().eq("business_id", businessId);
  const files = await db().storage.from("source-files").list(businessId, { limit: 1000 });
  if (files.data?.length) await db().storage.from("source-files").remove(files.data.map((f) => `${businessId}/${f.name}`));
  await db().from("source_files").delete().eq("business_id", businessId);
}

async function populate(slug: SampleSlug, businessId: string) {
  if (ANSWERS[slug]) await saveAnswers(businessId, ANSWERS[slug]!);
  switch (slug) {
    case "metro-roofing":
      await load(businessId, "metro-roofing-estimates-updated.csv", S.metroEstimates(true), "sales_opportunity");
      await load(businessId, "metro-roofing-invoices.csv", S.metroInvoices(), "invoice");
      await load(businessId, "metro-roofing-expenses.csv", S.metroExpenses(), "expense");
      break;
    case "brightpath-consulting":
      await load(businessId, "brightpath-proposals.csv", S.brightpathProposals(), "sales_opportunity", { Closed: "won" });
      await load(businessId, "brightpath-invoices.csv", S.brightpathInvoices(), "invoice");
      break;
    case "freshstart-cleaning":
      await load(businessId, "freshstart-invoices.csv", S.freshstartInvoices(), "invoice");
      await load(businessId, "freshstart-payments.csv", S.freshstartPayments(), "payment");
      await load(businessId, "freshstart-expenses.csv", S.freshstartExpenses(), "expense");
      await db().from("cash_positions").insert({ business_id: businessId, as_of: "2026-11-07", cash_on_hand: 38500 });
      break;
    case "beauty-lounge":
      await db().from("manual_weekly_entries").insert(S.beautyLoungeWeeks().map((w) => ({ business_id: businessId, ...w })));
      break;
    case "neighborhood-kitchen":
      await load(businessId, "neighborhood-kitchen-expenses.csv", S.kitchenExpenses(), "expense");
      break;
  }
  await runAssessment(businessId, "Sample data loaded");
}

/**
 * Reset one fictional sample business to its baseline. Only touches that business (is_sample) — never real data.
 * scratch=true (Metro only) restores the blank onboarding state for the original readiness walkthrough.
 */
export async function resetSampleBusiness(slug: SampleSlug, opts: { scratch?: boolean } = {}) {
  const b = (await db().from("businesses").select("id,is_sample").eq("slug", slug).single()).data;
  if (!b) throw new Error(`Unknown sample business ${slug}`);
  if (!b.is_sample) throw new Error("Only fictional sample businesses can be reset.");
  await clearBusinessData(b.id);
  const blank = { industry: null, sales_tracking: null, invoicing: null, biggest_challenge: null, ai_experience: null, main_goal: null };
  if (opts.scratch && slug === "metro-roofing") {
    await db().from("businesses").update({ ...blank, name: "Metro Roofing", data_path: "spreadsheet", onboarded: false }).eq("id", b.id);
    return b.id as string;
  }
  await db().from("businesses").update({ ...blank, ...BUSINESSES[slug] }).eq("id", b.id);
  await populate(slug, b.id);
  return b.id as string;
}

/** Simulated cohort members so the sponsor dashboard shows program scale. Clearly flagged is_cohort_sim. */
async function seedCohort(sponsorId: string, count: number, seed: number) {
  const industries = ["Landscaping", "Auto repair", "Bakery", "Dental office", "Plumbing", "Fitness studio", "Accounting firm", "Florist", "Pet grooming", "HVAC"];
  let r = seed;
  const rand = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  for (let n = 0; n < count; n++) {
    const enrolled = new Date(Date.UTC(2026, 7, 10 + Math.floor(rand() * 75)));
    const b = must(await db().from("businesses").insert({
      sponsor_id: sponsorId, name: `Simulated cohort business ${n + 1}`, industry: industries[Math.floor(rand() * industries.length)],
      onboarded: rand() > 0.12, is_sample: true, is_cohort_sim: true, enrolled_at: enrolled.toISOString(), created_at: enrolled.toISOString(),
    }).select("id,onboarded").single(), "Cohort business") as { id: string; onboarded: boolean };
    if (!b.onboarded) continue;
    const steps = 1 + Math.floor(rand() * 3);
    let readyCount = Math.floor(rand() * 2);
    for (let s = 0; s < steps; s++) {
      const at = new Date(enrolled.getTime() + (s * 12 + 2) * 86400000);
      const a = must(await db().from("readiness_assessments").insert({ business_id: b.id, trigger: "Simulated cohort activity", run_at: at.toISOString() }).select("id").single(), "Cohort assessment") as { id: string };
      await db().from("capability_status").insert(CAPABILITIES.map((c, i) => ({ assessment_id: a.id, business_id: b.id, capability: c.key, status: i < readyCount ? "ready" : i < readyCount + 2 ? "needs_setup" : "not_assessed" })));
      if (s > 0) await db().from("events").insert({ business_id: b.id, kind: "record_quality_improved", payload: { simulated: true }, created_at: at.toISOString() });
      readyCount = Math.min(8, readyCount + 1 + Math.floor(rand() * 2));
    }
    const tasks = 2 + Math.floor(rand() * 5);
    const done = Math.floor(tasks * rand());
    await db().from("tasks").insert(Array.from({ length: tasks }, (_, i) => ({ business_id: b.id, source_agent: "readiness", title: `Simulated task ${i + 1}`, status: i < done ? "done" : "open" })));
    if (rand() > 0.35) await db().from("agent_runs").insert({ business_id: b.id, agent: "sales", question: "(simulated cohort activity)", model: "simulated", status: "completed" });
    if (rand() > 0.55) await db().from("agent_runs").insert({ business_id: b.id, agent: "finance", question: "(simulated cohort activity)", model: "simulated", status: "completed" });
  }
}

export async function seedAll(log: (s: string) => void = () => {}) {
  const existing = must(await db().from("businesses").select("id"), "List") as Array<{ id: string }>;
  for (const b of existing) await clearBusinessData(b.id);
  await db().from("businesses").delete().not("id", "is", null);
  await db().from("sponsors").delete().not("id", "is", null);
  const sponsors = must(await db().from("sponsors").insert(SPONSORS).select("id,slug"), "Sponsors") as Array<{ id: string; slug: string }>;
  const northstar = sponsors.find((s) => s.slug === "northstar")!.id;
  const harborline = sponsors.find((s) => s.slug === "harborline")!.id;
  for (const slug of Object.keys(BUSINESSES) as SampleSlug[]) {
    log(`Seeding ${slug}`);
    const b = must(await db().from("businesses").insert({ slug, sponsor_id: northstar, is_sample: true, ...BUSINESSES[slug] }).select("id").single(), "Business") as { id: string };
    await populate(slug, b.id);
  }
  log("Seeding simulated cohorts");
  await seedCohort(northstar, 18, 7);
  await seedCohort(harborline, 9, 13);
  log("Done");
}

export type { SampleSlug };
