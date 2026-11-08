// Manual check: reset a sample business and run a live Intelligence Scan, printing every event.
// Usage: NODE_USE_ENV_PROXY=1 npx tsx --env-file=.env.local --conditions=react-server scripts/scan-check.ts [slug] [--no-reset] [--follow-up]
import { resetSampleBusiness, type SampleSlug } from "../lib/seed";
import { runScan } from "../lib/intelligence/scan";
import { listFindings } from "../lib/intelligence/findings";
import { db } from "../lib/db/client";

(async () => {
  const slug = (process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "metro-roofing") as SampleSlug;
  const id = process.argv.includes("--no-reset") ? (await db().from("businesses").select("id").eq("slug", slug).single()).data!.id : await resetSampleBusiness(slug);
  const t0 = Date.now();
  await runScan({
    businessId: id, trigger: process.argv.includes("--follow-up") ? "follow_up" : "manual",
    onEvent: (e) => {
      const s = (Date.now() - t0) / 1000;
      if (e.type === "step") console.log(`${s.toFixed(1)}s [${e.agent}] ${e.step.kind === "model_call" ? "AI" : "tool"} ${e.step.tool ?? ""}: ${e.step.output_summary}`);
      else if (e.type === "agent") console.log(`${s.toFixed(1)}s == ${e.agent} ${e.phase} ${e.focus ? "— " + e.focus : ""}`);
      else console.log(`${s.toFixed(1)}s`, JSON.stringify(e).slice(0, 600));
    },
  });
  const f = await listFindings(id, { open: true });
  console.log("\nOPEN FINDINGS:", f.length);
  for (const x of f) console.log(`- [${x.agent}/${x.priority}/${x.status}] ${x.category}: ${x.title} | value ${x.value} ${x.value_kind} | refs ${x.record_refs.length}`);
  const drafts = await db().from("drafts").select("kind,recipient,finding_id").eq("business_id", id);
  const tasks = await db().from("tasks").select("title,finding_id").eq("business_id", id).not("finding_id", "is", null);
  console.log("DRAFTS:", drafts.data?.map((d) => `${d.kind}:${d.recipient}`).join(", "));
  console.log("TASKS:", tasks.data?.map((t) => t.title).join(" | "));
})().catch((e) => { console.error(e); process.exit(1); });
