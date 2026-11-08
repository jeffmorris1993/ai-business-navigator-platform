// End-to-end check of the proactive Intelligence Engine demo (acceptance tests 1-9, 11).
// Usage: BASE_URL=http://localhost:3000 [NO_KEY_URL=http://localhost:3002] [SHOTS_DIR=...] npx tsx e2e/intelligence-flow.ts
import { chromium, request, type Page, type APIRequestContext } from "playwright";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR;
const ok = (m: string) => console.log(`✓ ${m}`);
let page: Page;

async function shot(name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

async function openFindings(api: APIRequestContext) {
  const j = await (await api.get(`${BASE}/api/findings`)).json();
  return j.open as number;
}

async function allFindings(api: APIRequestContext) {
  return (await (await api.get(`${BASE}/api/findings?status=all`)).json()).findings as Array<Record<string, any>>;
}

async function streamScan(api: APIRequestContext, body: Record<string, unknown>) {
  const r = await api.post(`${BASE}/api/intelligence/scan`, { data: body, timeout: 300_000 });
  const text = await r.text();
  if (r.status() !== 200) return { status: r.status(), events: [] as Array<Record<string, any>>, text };
  return { status: 200, events: text.trim().split("\n").map((l) => JSON.parse(l)) as Array<Record<string, any>>, text };
}

async function main() {
  const browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  page.setDefaultTimeout(60_000);
  page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

  // Test 9: reset to baseline
  await page.request.post(`${BASE}/api/session`, { data: { role: "owner", businessSlug: "metro-roofing" } });
  await page.goto(`${BASE}/overview`);
  await page.getByRole("button", { name: "Demo Mode" }).click();
  await page.getByRole("button", { name: /Reset demo/ }).click();
  await page.getByText("Demo reset to baseline").waitFor({ timeout: 90_000 });
  await page.getByText("Your records are in. No AI investigation has run yet.").waitFor();
  await page.getByText(/40 estimates, 12 invoices and 42 expenses on file/).waitFor();
  assert.ok(await page.getByText("No findings yet").isVisible());
  await shot("a-baseline");
  ok("Test 9: Demo reset returns Metro Roofing to a clean baseline (records loaded, no findings)");

  // Test 1 + 2: proactive scan from the button, no question typed
  await page.getByRole("button", { name: "Run AI Intelligence Scan", exact: true }).click();
  await page.getByText("Intelligence Engine").first().waitFor();
  await page.getByText(/Intelligence scan complete|Intelligence scan stopped/).waitFor({ timeout: 280_000 });
  assert.ok(await page.getByText("Intelligence scan complete").isVisible(), "scan should complete");
  const consoleText = await page.locator("text=AI decisions").first().locator("xpath=ancestor::div[contains(@class,'overflow-hidden')][1]").innerText();
  assert.match(consoleText, /delegate_investigation/);
  assert.match(consoleText, /Sales Agent|Financial Agent/);
  assert.match(consoleText, /record_finding/);
  await shot("b-scan-console");
  const counts = consoleText.match(/(\d+)\s*new findings/);
  assert.ok(counts && Number(counts[1]) > 0, "scan should record findings");
  ok(`Tests 1-2: scan ran without a typed question; the coordinator delegated to specialists that chose tools and recorded ${counts![1]} findings`);

  // Test 3: findings persist
  await page.reload();
  await page.getByText("Priority intelligence").waitFor();
  const api = page.request;
  const open1 = await openFindings(api);
  assert.ok(open1 > 0);
  await page.goto(`${BASE}/inbox`);
  await page.getByText("Why it matters").waitFor();
  await shot("c-inbox");
  ok(`Test 3: after refresh the Intelligence Inbox still holds ${open1} open findings`);

  // Test 4: prepared work
  await page.goto(`${BASE}/actions`);
  const actionsText = await page.locator("main").innerText();
  const hasDraft = /(Follow-up|Payment reminder) for /.test(actionsText);
  assert.ok(hasDraft || /Prepared by AI\s*\n\s*[1-9]/.test(actionsText), "agents should prepare a draft or task");
  if (hasDraft) {
    await page.locator("button", { hasText: /(Follow-up|Payment reminder) for / }).first().click();
    await page.getByRole("button", { name: "Approve", exact: true }).first().click();
    await page.getByText(/Approved (follow-up|payment reminder) for/).first().waitFor();
  }
  await shot("d-actions");
  ok(hasDraft ? "Test 4: agents prepared drafts linked to findings; owner reviewed and approved one (not sent)" : "Test 4: agents prepared tasks linked to findings (no drafts this run)");

  // Test 5: no duplicates on a re-run without changes
  const rerun = await streamScan(api, {});
  assert.equal(rerun.status, 200, rerun.text);
  const done1 = rerun.events.find((e) => e.type === "done");
  assert.ok(done1, `rerun failed: ${JSON.stringify(rerun.events.find((e) => e.type === "error"))}`);
  const open2 = await openFindings(api);
  assert.ok(open2 <= open1 + 1, `open findings grew from ${open1} to ${open2}`);
  assert.ok(done1.scan.findings_updated > 0, "rerun should update existing findings");
  ok(`Test 5: re-running without changes updated ${done1.scan.findings_updated} findings and created ${done1.scan.findings_new} (open ${open1} → ${open2}), no duplicates`);

  // Test 6: record payment → balances and findings update, follow-up scan reflects it
  await page.goto(`${BASE}/finance`);
  const overdueBefore = await page.locator("text=Overdue").first().locator("..").innerText();
  await page.getByRole("button", { name: "Demo Mode" }).click();
  await page.getByRole("banner").getByRole("button", { name: "Record payment" }).click();
  await page.getByText(/Recorded a .* payment from/).waitFor();
  await page.reload();
  const overdueAfter = await page.locator("text=Overdue").first().locator("..").innerText();
  assert.notEqual(overdueBefore, overdueAfter);
  const follow = await streamScan(api, { followUp: true });
  const done2 = follow.events.find((e) => e.type === "done");
  assert.ok(done2, "follow-up scan should complete");
  const resolvedNow = (await allFindings(api)).filter((f) => f.status === "resolved");
  assert.ok(resolvedNow.length > 0, "some finding should be resolved after the payment");
  await page.goto(`${BASE}/overview`);
  await shot("e-after-followup");
  ok(`Test 6: payment changed overdue (${overdueBefore.split("\n")[1]} → ${overdueAfter.split("\n")[1]}); software resolved/updated findings; follow-up scan completed (${done2.scan.findings_resolved} resolved)`);

  // Test 8: import trigger
  const stage = await api.post(`${BASE}/api/import/stage`, { multipart: { file: { name: "metro-roofing-new-estimates.csv", mimeType: "text/csv", buffer: readFileSync("public/samples/metro-roofing-new-estimates.csv") } }, timeout: 90_000 });
  const st = await stage.json();
  const mapping = { recordType: st.suggestion.recordType, columns: Object.fromEntries(st.suggestion.columns.map((c: any) => [c.header, c.field])), statusMap: Object.fromEntries(st.suggestion.statusValues.filter((v: any) => v.suggested).map((v: any) => [v.raw, v.suggested])) };
  const commit = await api.post(`${BASE}/api/import/commit`, { data: { stagingPath: st.stagingPath, filename: st.filename, mapping, mode: "update" }, timeout: 300_000 });
  const evs = (await commit.text()).trim().split("\n").map((l) => JSON.parse(l));
  assert.equal(evs[0].type, "import");
  const scanEv = evs.find((e) => e.type === "scan");
  assert.equal(scanEv?.trigger, "import");
  assert.ok(evs.find((e) => e.type === "done"), "import-triggered scan should complete");
  ok(`Test 8: importing ${evs[0].result.inserted} new estimates automatically started an intelligence scan (trigger: import)`);

  // Test 7: readiness gating on a business without contact dates
  await api.post(`${BASE}/api/demo/reset`, { data: { slug: "metro-roofing", scratch: true } });
  await api.post(`${BASE}/api/onboarding`, { data: { name: "Metro Roofing", industry: "Roofing and construction", sales_tracking: "Excel spreadsheets", invoicing: "QuickBooks", biggest_challenge: "Following up with customers", main_goal: "Increase sales", answers: { customer_permission: "yes", human_approval: "yes" } } });
  const st2 = await (await api.post(`${BASE}/api/import/stage`, { multipart: { file: { name: "metro-roofing-estimates.xlsx", mimeType: "application/octet-stream", buffer: readFileSync("public/samples/metro-roofing-estimates.xlsx") } }, timeout: 90_000 })).json();
  const map2 = { recordType: "sales_opportunity", columns: Object.fromEntries(st2.suggestion.columns.map((c: any) => [c.header, c.field])), statusMap: Object.fromEntries(st2.suggestion.statusValues.filter((v: any) => v.suggested).map((v: any) => [v.raw, v.suggested])) };
  const ev2 = (await (await api.post(`${BASE}/api/import/commit`, { data: { stagingPath: st2.stagingPath, filename: st2.filename, mapping: map2, autoScan: false }, timeout: 120_000 })).text()).trim().split("\n").map((l) => JSON.parse(l));
  assert.equal(ev2[0].type, "import");
  const gated = await streamScan(api, {});
  const steps = gated.events.filter((e) => e.type === "step").map((e) => e.step.output_summary as string);
  assert.ok(steps.some((s) => /isn't available yet|Readiness gap|last contact/i.test(s)) || gated.text.includes("readiness_gap"));
  const gatedFindings = await allFindings(api);
  assert.ok(!gatedFindings.some((f) => f.category === "stale_opportunities"), "must not invent stale-estimate findings");
  assert.ok(gatedFindings.some((f) => f.category === "readiness_gap" && f.subject === "missed_followup"), "should record the missing contact-date gap");
  ok("Test 7: without contact dates, no stale-estimate finding was invented; a readiness gap with a fix was recorded");

  // Test 11: honest status without a key
  if (process.env.NO_KEY_URL) {
    const nk = await request.newContext({ baseURL: process.env.NO_KEY_URL });
    await nk.post("/api/session", { data: { role: "owner", businessSlug: "brightpath-consulting" } });
    const r = await nk.post("/api/intelligence/scan", { data: {} });
    assert.equal(r.status(), 503);
    const html = await (await nk.get("/overview")).text();
    assert.match(html, /Live AI is unavailable/);
    assert.match(html, /Run software checks only/);
    const sw = await nk.post("/api/intelligence/scan", { data: { mode: "software_only" }, timeout: 120_000 });
    const swText = await sw.text();
    assert.match(swText, /Software checks only \(no AI investigation\)/);
    ok("Test 11: without a key the scan refuses honestly; software-only mode is clearly labeled");
  }

  // leave Metro at baseline for the next demo
  await api.post(`${BASE}/api/demo/reset`, { data: { slug: "metro-roofing" } });
  await browser.close();
  console.log("\nIntelligence flow checks passed.");
}

main().catch(async (e) => {
  console.error("✗", e);
  if (page && SHOTS) await page.screenshot({ path: `${SHOTS}/failure.png`, fullPage: true }).catch(() => {});
  process.exit(1);
});
