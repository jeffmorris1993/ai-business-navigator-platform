/* eslint-disable @typescript-eslint/no-explicit-any -- e2e scripts parse untyped NDJSON events */
// Example-company onboarding + mobile menu checks.
// Usage: BASE_URL=http://localhost:3000 [SHOTS_DIR=...] npx tsx e2e/presets-flow.ts
import { chromium, devices, type Page } from "playwright";
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR;
const ok = (m: string) => console.log(`✓ ${m}`);
let page: Page;
const shot = async (n: string) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true }); };

async function findings() {
  return (await (await page.request.get(`${BASE}/api/findings?status=all`)).json()).findings as Array<Record<string, any>>;
}

async function main() {
  const browser = await chromium.launch();

  // 1. Mobile menu
  const mobile = await browser.newContext({ ...devices["iPhone 13"] });
  page = await mobile.newPage();
  await page.request.post(`${BASE}/api/session`, { data: { role: "owner", businessSlug: "metro-roofing" } });
  await page.goto(`${BASE}/overview`);
  await page.getByRole("button", { name: "Open navigation" }).click();
  const sheet = page.getByRole("dialog", { name: "Navigation" });
  await sheet.waitFor();
  const box = await sheet.locator("> div").boundingBox();
  assert.ok(box && box.height > 500, `menu sheet should fill the screen height, got ${box?.height}`);
  await shot("m-menu-open");
  await sheet.getByRole("link", { name: "Intelligence Inbox" }).click();
  await page.waitForURL("**/inbox");
  assert.equal(await page.getByRole("dialog", { name: "Navigation" }).count(), 0);
  ok(`Mobile: menu opens full height (${Math.round(box!.height)}px) above the app and navigates`);
  await page.getByRole("button", { name: "Demo Mode" }).click();
  await page.getByText("Real actions on fictional sample data only.").waitFor();
  await page.mouse.click(10, 600);
  assert.equal(await page.getByText("Real actions on fictional sample data only.").count(), 0, "Demo Mode panel should close on outside tap");
  ok("Mobile: Demo Mode panel opens and closes on outside tap");
  await mobile.close();

  // 2. Spreadsheet preset from scratch: Summit Heating & Air
  const desk = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  page = await desk.newPage();
  page.setDefaultTimeout(60_000);
  page.on("pageerror", (e) => console.log("  [pageerror]", e.message));
  await page.goto(`${BASE}/start`);
  await shot("p-start");
  const summit = page.locator("div.rounded-lg", { hasText: "Summit Heating & Air" }).filter({ has: page.getByRole("button", { name: /Onboard from scratch/ }) }).last();
  await summit.getByRole("button", { name: /Onboard from scratch/ }).click();
  await page.waitForURL("**/onboarding");
  await page.getByRole("button", { name: "Use Summit Heating & Air's answers" }).click();
  assert.equal(await page.getByRole("textbox").first().inputValue(), "Summit Heating & Air");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Create my readiness report" }).click();
  await page.waitForURL("**/readiness?welcome=1");
  await page.getByText("Initial AI readiness report").waitFor();
  await page.getByRole("button", { name: "Upload my spreadsheet" }).click();
  await page.getByRole("button", { name: "Job quotes" }).click();
  await page.getByRole("button", { name: /Confirm and import 24 rows/ }).waitFor({ timeout: 90_000 });
  const onHoldRow = page.locator("div.rounded-lg", { hasText: '"On Hold"' }).last();
  await onHoldRow.locator("select").selectOption("open");
  await page.getByRole("button", { name: /Confirm and import 24 rows/ }).click();
  await page.getByText("Import complete").waitFor();
  await page.getByText(/Intelligence scan complete|Intelligence scan stopped/).waitFor({ timeout: 280_000 });
  assert.ok(await page.getByText("Intelligence scan complete").isVisible());
  await shot("p-summit-import-scan");
  const f1 = await findings();
  assert.ok(f1.length > 0, "import-triggered scan should save findings");
  ok(`Summit (spreadsheet): onboarded from scratch with preset answers, uploaded its job quotes, answered "On Hold", import auto-scan saved ${f1.length} findings`);

  // 3. Manual preset from scratch: Iron & Oak Fitness
  await page.goto(`${BASE}/start`);
  const iron = page.locator("div.rounded-lg", { hasText: "Iron & Oak Fitness" }).filter({ has: page.getByRole("button", { name: /Onboard from scratch/ }) }).last();
  await iron.getByRole("button", { name: /Onboard from scratch/ }).click();
  await page.waitForURL("**/onboarding");
  await page.getByRole("button", { name: "Use Iron & Oak Fitness's answers" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Create my readiness report" }).click();
  await page.waitForURL("**/readiness?welcome=1");
  await page.getByRole("link", { name: "Enter weekly numbers" }).click();
  await page.waitForURL("**/data#weekly");
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: /Fill week of/ }).click();
    await page.getByRole("button", { name: "Save week" }).click();
    await page.waitForTimeout(2500);
  }
  await page.goto(`${BASE}/readiness`);
  const cap = await page.locator('[data-capability="appointment_capacity"]').innerText();
  assert.match(cap, /Ready/);
  await shot("p-ironoak-readiness");
  const scan = await page.request.post(`${BASE}/api/intelligence/scan`, { data: {}, timeout: 300_000 });
  const evs = (await scan.text()).trim().split("\n").map((l) => JSON.parse(l));
  assert.ok(evs.find((e) => e.type === "done"), `manual scan failed: ${JSON.stringify(evs.find((e) => e.type === "error"))}`);
  const f2 = await findings();
  assert.ok(f2.length > 0);
  assert.ok(!f2.some((f) => ["stale_opportunities", "overdue_invoices", "customer_balance"].includes(f.category)), "no customer-level findings from weekly totals");
  ok(`Iron & Oak (manual): entered 2 example weeks by hand → capacity Ready → scan saved ${f2.length} findings (${[...new Set(f2.map((f) => f.category))].join(", ")}), no invented customers`);

  // 4. Open with data
  await page.goto(`${BASE}/start`);
  const riv = page.locator("div.rounded-lg", { hasText: "Riverside Auto Care" }).filter({ has: page.getByRole("button", { name: /Open with data/ }) }).last();
  await riv.getByRole("button", { name: /Open with data/ }).click();
  await page.waitForURL("**/overview");
  await page.getByText("$17,150").first().waitFor();
  ok("Riverside: Open with data shows its loaded records ($17,150 overdue)");

  // restore the two scratch-onboarded companies to their data-loaded baseline
  for (const slug of ["summit-hvac", "iron-oak-fitness"]) await page.request.post(`${BASE}/api/demo/reset`, { data: { slug }, timeout: 120_000 });
  await browser.close();
  console.log("\nPreset flow checks passed.");
}

main().catch(async (e) => {
  console.error("✗", e);
  if (page && SHOTS) await page.screenshot({ path: `${SHOTS}/failure.png`, fullPage: true }).catch(() => {});
  process.exit(1);
});
