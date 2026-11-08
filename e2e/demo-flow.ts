// End-to-end walk through the five-minute demo against a running server.
// Usage: BASE_URL=http://localhost:3000 npx tsx e2e/demo-flow.ts   (needs a seeded database)
import { chromium, type Page } from "playwright";
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR;
const LIVE = process.env.EXPECT_LIVE_AI !== "0";

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

function log(msg: string) {
  console.log(`✓ ${msg}`);
}

let page: Page;
async function main() {
  const browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  page.on("console", (m) => m.type() === "error" && console.log("  [browser]", m.text()));
  page.setDefaultTimeout(60_000);

  // Minute 1: onboarding
  await page.goto(`${BASE}/demo`);
  await page.getByRole("button", { name: "Start the demo" }).click();
  await page.waitForURL("**/onboarding");
  await page.getByText("Use Metro Roofing's answers").click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Create my readiness report" }).click();
  await page.waitForURL("**/readiness?welcome=1");
  await page.getByText("Initial AI readiness report").waitFor();
  assert.ok(await page.getByText("I'm not marking anything as ready").isVisible());
  assert.equal(await page.locator('[data-capability] >> text="Ready"').count(), 0, "nothing should be Ready before data");
  await shot(page, "1-initial-readiness");
  log("Minute 1: onboarding created an initial report with no unverified Ready claims");

  // Minute 2: upload estimates without contact dates
  await page.getByRole("button", { name: "Upload my spreadsheet" }).click();
  await page.getByRole("button", { name: "metro-roofing-estimates.xlsx" }).click();
  await page.getByRole("button", { name: /Confirm and import 40 rows/ }).waitFor();
  const suggestedBy = (await page.getByText(/Suggested by (AI|matching rules)/).first().textContent()) ?? "";
  if (LIVE) assert.match(suggestedBy, /Suggested by AI/, "live AI should suggest mappings");
  await shot(page, "2a-mapping");
  await page.getByRole("button", { name: /Confirm and import 40 rows/ }).click();
  await page.getByText("Import complete").waitFor();
  const changes1 = await page.getByText("What changed in your AI readiness").locator("../..").innerText();
  assert.match(changes1, /Sales pipeline analysis[\s\S]*Ready/);
  assert.match(changes1, /Missed follow-up detection[\s\S]*Needs setup/);
  await shot(page, "2b-after-import");
  await page.keyboard.press("Escape");
  log(`Minute 2: imported 40 estimates (${suggestedBy.trim()}); pipeline Ready, follow-up Needs setup`);

  // Minute 3: fix missing contact dates via updated spreadsheet
  await page.reload();
  const followCard = page.locator('[data-capability="missed_followup"]');
  assert.match(await followCard.innerText(), /Needs setup/);
  assert.match(await followCard.innerText(), /Last contact date missing on 18 open estimates/);
  await followCard.getByRole("button", { name: "Fix This Now" }).click();
  await page.getByText("doesn't include when you last contacted them").waitFor();
  await page.getByRole("button", { name: "Updated estimates (with Last Call)" }).click();
  await page.getByRole("button", { name: /Confirm and import 40 rows/ }).click();
  await page.getByText("Import complete").waitFor();
  const changes2 = await page.getByText("What changed in your AI readiness").locator("../..").innerText();
  assert.match(changes2, /Missed follow-up detection[\s\S]*Needs setup[\s\S]*Ready/);
  assert.match(await page.getByText(/40 existing records updated/).innerText(), /40 existing records updated/);
  await shot(page, "3-followup-ready");
  log("Minute 3: updated sheet matched 40 records; Missed follow-up detection Needs setup → Ready");

  // Minute 4: Sales Intelligence
  await page.getByRole("link", { name: /Analyze My Sales Opportunities/ }).first().click();
  await page.waitForURL("**/sales?analyze=1");
  await page.getByText("11 open estimates totaling $62,000").waitFor();
  assert.ok(await page.getByText("potential pipeline value, not guaranteed revenue").first().isVisible());
  log("Minute 4: deterministic analysis shows 11 open estimates totaling $62,000 (potential)");
  if (LIVE) {
    await page.getByText("find_stale_opportunities").first().waitFor({ timeout: 120_000 });
    await page.locator("text=live model:").first().waitFor({ timeout: 120_000 });
    const activity = await page.getByText(/Agent activity · \d+ tool action/).first().locator("..").innerText();
    assert.match(activity, /11 have no contact in over 7 days/);
    await shot(page, "4a-sales-agent");
    log("Minute 4: Sales Agent called real tools (find_stale_opportunities) and answered");
  }
  await page.getByRole("button", { name: "Draft follow-up" }).first().click();
  await page.getByText(/Review draft for/).waitFor({ timeout: 60_000 });
  await page.getByRole("textbox", { name: "Message" }).fill((await page.getByRole("textbox", { name: "Message" }).inputValue()) + "\n\nP.S. Edited by the owner.");
  await page.getByRole("button", { name: "Approve" }).click();
  await page.getByText("Approved · not sent").waitFor();
  await shot(page, "4b-draft-approved");
  await page.keyboard.press("Escape");
  log("Minute 4: follow-up draft edited and approved (not sent)");

  // Minute 5: Financial Intelligence
  await page.goto(`${BASE}/finance`);
  await page.getByRole("button", { name: "metro-roofing-invoices.csv" }).click();
  await page.getByRole("button", { name: /Confirm and import 12 rows/ }).click();
  await page.getByText("Import complete").waitFor();
  await page.reload();
  await page.getByText("$31,700.00").first().waitFor();
  const row = page.locator("tr", { hasText: "Imani Carter" });
  await row.getByRole("button", { name: "Record payment" }).click();
  await page.getByRole("button", { name: "Record payment" }).last().click();
  await page.getByText(/Payment recorded/).waitFor();
  await page.waitForTimeout(1500);
  await page.reload();
  await page.getByText("$30,300.00").first().waitFor();
  await shot(page, "5a-finance");
  log("Minute 5: overdue $31,700.00 → recorded $1,400 payment → $30,300.00");

  // Sponsor view and privacy
  await page.goto(`${BASE}/sponsor-access`);
  await page.getByText("Sign in as Northstar Small Business AI Program").click();
  await page.waitForURL("**/sponsor");
  await page.getByText("Program impact").waitFor();
  const sponsorText = await page.locator("main").innerText();
  for (const secret of ["Imani Carter", "Dana Whitfield", "$31,700", "Metro Roofing"]) assert.ok(!sponsorText.includes(secret), `sponsor page must not show ${secret}`);
  await shot(page, "5b-sponsor");
  const blocked = await page.request.post(`${BASE}/api/tasks`, { data: { title: "x" } });
  assert.equal(blocked.status(), 401);
  const agent = await page.request.post(`${BASE}/api/agent`, { data: { question: "list invoices" } });
  assert.equal(agent.status(), 401);
  await page.goto(`${BASE}/finance`);
  assert.match(page.url(), /signin=1/);
  log("Sponsor sees aggregates only; record pages and APIs refuse the sponsor session");

  await browser.close();
  console.log("\nAll demo steps passed.");
}

main().catch(async (e) => {
  console.error("✗", e);
  if (page && SHOTS) await page.screenshot({ path: `${SHOTS}/failure.png`, fullPage: true }).catch(() => {});
  process.exit(1);
});
