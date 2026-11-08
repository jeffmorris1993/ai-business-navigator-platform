import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { PRESETS } from "@/lib/samples/presets";
import { samplesFor } from "@/lib/samples/catalog";
import * as S from "@/lib/samples/data";
import { heuristicMapping } from "@/lib/import/heuristics";
import { findOverdueInvoices } from "@/lib/calc/finance";
import { findStaleOpportunities } from "@/lib/calc/sales";
import { assessAll, type ReadinessInput } from "@/lib/readiness/rules";
import { importRows } from "./helpers";
import type { Business, Invoice, ManualWeek, SalesOpportunity } from "@/lib/types";

const TODAY = "2026-11-08";

describe("example-company presets", () => {
  it("has 9 companies across industries, 3 of them manual", () => {
    expect(PRESETS).toHaveLength(9);
    expect(new Set(PRESETS.map((p) => p.profile.industry)).size).toBe(9);
    expect(PRESETS.filter((p) => p.records === "manual")).toHaveLength(3);
  });
  it("every preset has answers, a problem, steps and data", () => {
    for (const p of PRESETS) {
      expect(p.problem.length).toBeGreaterThan(20);
      expect(p.steps.length).toBeGreaterThan(1);
      expect(Object.keys(p.answers).length).toBeGreaterThan(2);
      if (p.records === "manual") expect(p.weeks?.length).toBeGreaterThanOrEqual(5);
      else expect(Object.values(p.files).flat().length).toBeGreaterThan(0);
    }
  });
  it("every referenced sample file exists", () => {
    for (const p of PRESETS) for (const f of Object.values(p.files).flat()) expect(existsSync(`public/samples/${f!.file}`), f!.file).toBe(true);
  });
  it("the catalog offers each company's own files", () => {
    expect(samplesFor("summit-hvac", "sales")[0].file).toBe("summit-hvac-jobs.csv");
    expect(samplesFor("riverside-auto", "expenses")[0].file).toBe("riverside-auto-expenses.csv");
    expect(samplesFor("iron-oak-fitness", "sales")).toEqual([]);
  });
});

describe("new example data", () => {
  it("Summit: maps unusual headers, asks about On Hold, has stale quotes and overdue invoices", () => {
    const jobs = S.summitJobs();
    const m = heuristicMapping(Object.keys(jobs[0]), jobs);
    expect(m.statusValues.find((v) => v.raw === "On Hold")?.ambiguous).toBe(true);
    const { records } = importRows<SalesOpportunity>(jobs, undefined, { "On Hold": "open" });
    expect(records.filter((o) => o.status === "open")).toHaveLength(S.SUMMIT_EXPECTED.openJobs + S.SUMMIT_EXPECTED.onHold);
    expect(findStaleOpportunities(records, TODAY).stale.length).toBeGreaterThan(3);
    const inv = importRows<Invoice>(S.summitInvoices()).records;
    const o = findOverdueInvoices(inv, TODAY);
    expect(o.count).toBe(S.SUMMIT_EXPECTED.overdueCount);
    expect(o.total).toBe(S.SUMMIT_EXPECTED.overdueTotal);
  });
  it("Riverside: repair orders overdue, one fleet account owes most", () => {
    const o = findOverdueInvoices(importRows<Invoice>(S.riversideInvoices()).records, TODAY);
    expect(o.count).toBe(S.RIVERSIDE_EXPECTED.overdueCount);
    expect(o.total).toBe(S.RIVERSIDE_EXPECTED.overdueTotal);
    expect(o.byCustomer[0].customer).toBe("Bayside Delivery Fleet");
  });
  it("manual businesses: capacity readiness goes needs setup → partial → ready as weeks are entered", () => {
    const biz: Business = { id: "b", slug: "iron-oak-fitness", sponsor_id: null, name: "Iron & Oak Fitness", industry: "Fitness studio", sales_tracking: "Paper sign-in sheets", invoicing: null, biggest_challenge: null, ai_experience: null, main_goal: null, data_path: "manual", onboarded: true, is_sample: true };
    const base: ReadinessInput = { business: biz, answers: {}, opps: [], invoices: [], expenses: [], appointments: [], weeks: [], cash: null, lastUpdated: { manual: TODAY }, asOf: TODAY };
    const status = (weeks: ManualWeek[]) => assessAll({ ...base, weeks }).find((r) => r.capability === "appointment_capacity")!.status;
    const all = S.ironOakWeeks().map((w, i) => ({ id: String(i), ...w })) as ManualWeek[];
    expect(status([])).toBe("needs_setup");
    expect(status(all.slice(0, 1))).toBe("partial");
    expect(status(all.slice(0, 2))).toBe("ready");
  });
});
