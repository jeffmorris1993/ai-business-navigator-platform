// Applies supabase/migrations/*.sql through the Supabase Management API (HTTPS).
// Equivalent to `supabase db push` when a direct database connection isn't available.
// Needs SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF. Usage: npm run db:migrate -- <file.sql>
import { readFileSync, readdirSync } from "node:fs";

const ref = process.env.SUPABASE_PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !token) throw new Error("Set SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN");
const files = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync("supabase/migrations").sort().map((f) => `supabase/migrations/${f}`);
(async () => {
  for (const f of files) {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ query: readFileSync(f, "utf8") }),
    });
    console.log(f, res.status, (await res.text()).slice(0, 300));
    if (!res.ok) process.exit(1);
  }
})();
