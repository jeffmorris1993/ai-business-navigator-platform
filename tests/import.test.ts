import { describe, it, expect } from "vitest";
import { heuristicMapping, suggestStatuses } from "@/lib/import/heuristics";
import { normalizeRows, validateMapping } from "@/lib/import/normalize";
import { parseCsv, parseXlsx } from "@/lib/import/parse";
import { readFileSync } from "node:fs";
import * as S from "@/lib/samples/data";
import { importRows } from "./helpers";
import type { SalesOpportunity } from "@/lib/types";

describe("Acceptance test 2: different column names → same structure", () => {
  it("maps roofing headers", () => {
    const rows = S.metroEstimates(true);
    const m = heuristicMapping(Object.keys(rows[0]), rows);
    expect(m.recordType).toBe("sales_opportunity");
    const map = Object.fromEntries(m.columns.map((c) => [c.header, c.field]));
    expect(map).toEqual({ Homeowner: "customer", "Bid Amt": "amount", "Date Quoted": "quoted_on", "Last Call": "last_contact_on", Result: "status" });
  });
  it("maps consulting headers", () => {
    const rows = S.brightpathProposals();
    const m = heuristicMapping(Object.keys(rows[0]), rows);
    expect(m.recordType).toBe("sales_opportunity");
    const map = Object.fromEntries(m.columns.map((c) => [c.header, c.field]));
    expect(map).toEqual({ Organization: "customer", "Proposal Fee": "amount", Submitted: "quoted_on", "Last Email": "last_contact_on", Stage: "status" });
  });
  it("asks about the ambiguous 'Closed' stage instead of guessing", () => {
    const rows = S.brightpathProposals();
    const m = heuristicMapping(Object.keys(rows[0]), rows);
    const closed = m.statusValues.find((s) => s.raw === "Closed")!;
    expect(closed.ambiguous).toBe(true);
    expect(closed.suggested).toBeNull();
    expect(m.statusValues.find((s) => s.raw === "Signed")!.suggested).toBe("won");
  });
  it("both normalize into identical record shapes", () => {
    const a = importRows<SalesOpportunity>(S.metroEstimates(true)).records[0];
    const b = importRows<SalesOpportunity>(S.brightpathProposals(), undefined, { Closed: "won" }).records[0];
    expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());
    expect(typeof b.amount).toBe("number");
    expect(b.quoted_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("unconfirmed statuses become 'unknown' with an issue, never guessed", () => {
    const rows = S.brightpathProposals();
    const m = heuristicMapping(Object.keys(rows[0]), rows);
    const statusMap: Record<string, string> = {};
    for (const s of m.statusValues) if (s.suggested) statusMap[s.raw] = s.suggested;
    const { records, issues } = normalizeRows(rows, { recordType: "sales_opportunity", columns: Object.fromEntries(m.columns.map((c) => [c.header, c.field])), statusMap });
    expect(records.filter((r) => r.values.status === "unknown")).toHaveLength(2);
    expect(issues.some((i) => i.value === "Closed")).toBe(true);
  });
  it("keeps source row references (spreadsheet row numbers)", () => {
    const { records } = importRows<SalesOpportunity>(S.metroEstimates(true));
    expect(records[0].source_row).toBe(2);
    expect(records[39].source_row).toBe(41);
  });
});

describe("validation", () => {
  it("warns when invoice total is mapped without a balance", () => {
    const v = validateMapping({ recordType: "invoice", columns: { Customer: "customer", Amount: "total_amount", Due: "due_on" }, statusMap: {} });
    expect(v.errors).toHaveLength(0);
    expect(v.warnings.join(" ")).toMatch(/not the same as an unpaid balance/);
  });
  it("errors on duplicate and missing required mappings", () => {
    const v = validateMapping({ recordType: "sales_opportunity", columns: { A: "customer", B: "customer" }, statusMap: {} });
    expect(v.errors.join(" ")).toMatch(/More than one column/);
    expect(v.errors.join(" ")).toMatch(/Estimate value/);
  });
  it("flags unparseable values and keeps them null", () => {
    const { records, issues } = normalizeRows([{ Homeowner: "A", "Bid Amt": "call me", "Date Quoted": "soon", Result: "Pending" }], {
      recordType: "sales_opportunity", columns: { Homeowner: "customer", "Bid Amt": "amount", "Date Quoted": "quoted_on", Result: "status" }, statusMap: { Pending: "open" },
    });
    expect(records[0].values.amount).toBeNull();
    expect(records[0].values.quoted_on).toBeNull();
    expect(issues).toHaveLength(2);
  });
  it("suggestStatuses flags unknown words", () => {
    expect(suggestStatuses("sales_opportunity", ["Maybe"])[0].ambiguous).toBe(true);
  });
});

describe("file parsing", () => {
  it("reads the sample xlsx and csv identically", async () => {
    const x = await parseXlsx("a.xlsx", readFileSync("public/samples/metro-roofing-estimates-updated.xlsx"));
    const c = parseCsv("a.csv", readFileSync("public/samples/metro-roofing-estimates-updated.csv", "utf8"));
    expect(x.headers).toEqual(c.headers);
    expect(x.rows).toHaveLength(40);
    expect(String(x.rows[0]["Homeowner"])).toBe(String(c.rows[0]["Homeowner"]));
  });
  it("treats formula-looking text as plain data", () => {
    const p = parseCsv("x.csv", 'Homeowner,Bid Amt\n"=HYPERLINK(""http://x"")",100');
    expect(p.rows[0].Homeowner).toBe('=HYPERLINK("http://x")');
  });
});
