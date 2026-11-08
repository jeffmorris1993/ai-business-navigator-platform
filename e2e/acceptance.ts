// API-level acceptance checks against a running, seeded server.
// Usage: BASE_URL=http://localhost:3000 npx tsx e2e/acceptance.ts
// Optional: NO_KEY_URL=http://localhost:3002 (a second server started with OPENAI_API_KEY unset) for test 9.
import { request, type APIRequestContext } from "playwright";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ok = (m: string) => console.log(`✓ ${m}`);

async function as(slug: string) {
  const ctx = await request.newContext({ baseURL: BASE });
  const r = await ctx.post("/api/session", { data: { role: "owner", businessSlug: slug } });
  assert.equal(r.status(), 200);
  return ctx;
}

async function agent(ctx: APIRequestContext, agentName: string, question: string) {
  const r = await ctx.post("/api/agent", { data: { agent: agentName, question }, timeout: 180_000 });
  assert.equal(r.status(), 200, await r.text());
  const events = (await r.text()).trim().split("\n").map((l) => JSON.parse(l));
  const done = events.find((e) => e.type === "done");
  assert.ok(done, `agent failed: ${JSON.stringify(events.find((e) => e.type === "error"))}`);
  const tools = events.filter((e) => e.type === "step" && e.step.kind === "tool_call").map((e) => e.step.tool as string);
  return { ...done, tools, steps: events.filter((e) => e.type === "step").map((e) => e.step) };
}

async function upload(ctx: APIRequestContext, file: string) {
  const r = await ctx.post("/api/import/stage", { multipart: { file: { name: file, mimeType: "text/csv", buffer: readFileSync(`public/samples/${file}`) } }, timeout: 90_000 });
  assert.equal(r.status(), 200, await r.text());
  return r.json();
}

async function main() {
  // Test 2: consulting spreadsheet with different headers → same structure, ambiguity asked
  {
    const ctx = await request.newContext({ baseURL: BASE });
    await ctx.post("/api/business", { data: { name: "Acceptance Test Consulting (fictional)" } });
    await ctx.post("/api/onboarding", { data: { name: "Acceptance Test Consulting (fictional)", industry: "Consulting", sales_tracking: "Google Sheets" } });
    const s = await upload(ctx, "brightpath-proposals.csv");
    const map = Object.fromEntries(s.suggestion.columns.map((c: { header: string; field: string }) => [c.header, c.field]));
    assert.deepEqual(map, { Organization: "customer", "Proposal Fee": "amount", Submitted: "quoted_on", "Last Email": "last_contact_on", Stage: "status" });
    const closed = s.suggestion.statusValues.find((v: { raw: string }) => v.raw === "Closed");
    assert.equal(closed.ambiguous, true);
    assert.equal(closed.suggested, null);
    const statusMap = Object.fromEntries(s.suggestion.statusValues.filter((v: { suggested: string }) => v.suggested).map((v: { raw: string; suggested: string }) => [v.raw, v.suggested]));
    statusMap.Closed = "won"; // the owner's answer
    const c = await ctx.post("/api/import/commit", { data: { stagingPath: s.stagingPath, filename: s.filename, mapping: { recordType: "sales_opportunity", columns: map, statusMap }, mode: "append", autoScan: false } });
    const cr = JSON.parse((await c.text()).trim().split("\n")[0]).result;
    assert.equal(cr.ok, true);
    assert.equal(cr.inserted, 14);
    ok(`Test 2: consulting headers mapped by ${s.suggestion.suggestedBy}; "Closed" was asked about, not guessed; 14 records normalized`);
    // Saved mapping is reused on the next upload
    const again = await upload(ctx, "brightpath-proposals.csv");
    assert.equal(again.suggestion.suggestedBy, "saved");
    ok("Test 2: confirmed mapping saved and reused on the next upload");
  }

  // Test 5: manual business
  {
    const reset = await request.newContext({ baseURL: BASE });
    await reset.post("/api/demo/reset", { data: { slug: "beauty-lounge" }, timeout: 60_000 });
    const r = await reset.post("/api/records/week", { data: { week_start: "2026-11-02", available_slots: 120, booked: 99, cancellations: 5, unfilled_slots: 21, avg_service_value: 72, weekly_sales: 6800 } });
    const body = await r.json();
    assert.equal(r.status(), 200);
    const cap = body.results.find((x: { capability: string }) => x.capability === "appointment_capacity");
    const follow = body.results.find((x: { capability: string }) => x.capability === "missed_followup");
    assert.equal(cap.status, "ready");
    assert.equal(follow.status, "needs_setup");
    const page = await (await reset.get("/sales")).text();
    assert.match(page, /Unused appointment capacity/);
    assert.match(page, /can.{0,6}t be identified from these numbers/);
    ok("Test 5: salon weekly numbers saved; capacity analysis Ready; customer follow-up correctly Needs Setup");
  }

  // Test 4 + 7: payments change balances; agent payment actions wait for approval
  {
    const ctx = await request.newContext({ baseURL: BASE });
    await ctx.post("/api/demo/reset", { data: { slug: "brightpath-consulting" }, timeout: 90_000 });
    const before = await agent(ctx, "finance", "Which customers owe me money? Give me the overdue total.");
    assert.ok(before.tools.includes("find_overdue_invoices"));
    assert.match(before.answer, /9,200/);
    ok(`Test 4: Financial Agent called ${before.tools.join(", ")}; reported $9,200 overdue`);
    const pay = await agent(ctx, "finance", "Record a payment of $500 received today (2026-11-08) on invoice BP-201.");
    assert.ok(pay.tools.includes("record_payment"), `tools: ${pay.tools}`);
    assert.equal(pay.pending.length, 1, "payment should be waiting for approval");
    const stillBefore = await agent(ctx, "finance", "What is the total overdue now? Just the number.");
    assert.match(stillBefore.answer, /9,200/);
    const approve = await ctx.post(`/api/pending/${pay.pending[0].id}`, { data: { approve: true } });
    assert.equal(approve.status(), 200, await approve.text());
    const after = await agent(ctx, "finance", "What is the total overdue now? Just the number.");
    assert.match(after.answer, /8,700/);
    ok("Test 7: agent's payment waited for approval (total stayed $9,200); after owner approval total became $8,700");
  }

  // Test 6: cash forecast without cash information
  {
    const ctx = await as("metro-roofing");
    const r = await agent(ctx, "finance", "Give me a 60-day cash-flow forecast.");
    assert.ok(r.tools.includes("calculate_cash_scenario") || r.tools.includes("assess_capability_readiness") || r.tools.includes("identify_missing_fields"), `tools: ${r.tools}`);
    console.log("  answer:", r.answer.replace(/\n+/g, " ").slice(0, 400));
    assert.match(r.answer, /cash on hand|bank balance|current cash/i);
    assert.doesNotMatch(r.answer, /ending cash (will be|of) \$/i);
    ok("Test 6: cash forecast refused and listed missing information (cash on hand) instead of inventing numbers");
  }

  // Test 3 via the Advisor: routing
  {
    const ctx = await as("metro-roofing");
    const r = await agent(ctx, "advisor", "Which customers should I follow up with?");
    assert.ok(r.tools.some((t: string) => ["find_stale_opportunities", "list_open_findings", "get_finding", "list_sales_opportunities"].includes(t)), `tools: ${r.tools}`);
    assert.match(r.answer, /Dana Whitfield|Marcus Bell|Priya Raman/);
    ok(`Test 3: Advisor routed to sales tools (${r.tools.join(", ")}) and named real customers from the records`);
  }

  // Test 8: sponsor privacy
  {
    const ctx = await request.newContext({ baseURL: BASE });
    await ctx.post("/api/session", { data: { role: "sponsor", sponsorSlug: "northstar" } });
    const m = await (await ctx.get("/api/sponsor/metrics")).json();
    const text = JSON.stringify(m);
    for (const forbidden of ["Metro Roofing", "BrightPath", "Dana Whitfield", "business_ref", "BP-201", "amount_due"]) assert.ok(!text.includes(forbidden), `sponsor metrics leaked ${forbidden}`);
    assert.ok(m.totals.enrolled > 0);
    for (const url of ["/api/tasks", "/api/records/payment", "/api/drafts"]) assert.equal((await ctx.post(url, { data: {} })).status(), 401);
    assert.equal((await ctx.get("/api/drafts/export")).status(), 401);
    ok("Test 8: sponsor metrics contain counts only; record APIs return 401 for sponsors");
  }

  // Test 9: no API key
  if (process.env.NO_KEY_URL) {
    const ctx = await request.newContext({ baseURL: process.env.NO_KEY_URL });
    await ctx.post("/api/session", { data: { role: "owner", businessSlug: "metro-roofing" } });
    const r = await ctx.post("/api/agent", { data: { agent: "sales", question: "hi" } });
    assert.equal(r.status(), 503);
    assert.equal((await r.json()).code, "live_ai_unavailable");
    const page = await (await ctx.get("/sales")).text();
    assert.match(page, /Live AI is unavailable/);
    assert.match(page, /AI unavailable/);
    const s = await (async () => {
      const r2 = await ctx.post("/api/import/stage", { multipart: { file: { name: "x.csv", mimeType: "text/csv", buffer: readFileSync("public/samples/brightpath-invoices.csv") } } });
      return r2.json();
    })();
    assert.equal(s.suggestion.suggestedBy, "rules");
    ok("Test 9: without a key, agents return live_ai_unavailable, the UI says so, and the importer labels rule-based suggestions");
  }
  console.log("\nAll acceptance checks passed.");
}

main().catch((e) => {
  console.error("✗", e);
  process.exit(1);
});
