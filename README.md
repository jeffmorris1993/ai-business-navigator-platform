# Sirrom Business AI Navigator

A working agentic AI platform from **Sirrom Studios** that helps small businesses get ready for AI, put it to work on their own records, and measure the results.

> "Tell us about your business. We'll help you understand where AI can help, get your information ready, and put AI to work improving your business."

All businesses, sponsors and records in this repository are **fictional sample data**. No real organization has approved, funded or endorsed this product.

## What's in it

| Capability | What it does | How it works |
|---|---|---|
| **Sirrom Intelligence Engine** | One click (or any import) starts an agentic investigation: an orchestrator dispatches the Readiness, Sales and Financial agents, which choose tools, record evidence-backed findings and prepare drafts/tasks | `lib/intelligence/scan.ts`, `app/api/intelligence/scan` (streams live activity); findings verified and valued by software in `lib/intelligence/evaluate.ts` |
| **Intelligence Inbox** | Persistent findings with priority, agent, software-computed value, evidence, source records, linked work and history; never duplicated; auto-resolved when records change | `findings` table, `lib/intelligence/findings.ts`, `/inbox` |
| **Agent Activity** | Every scan and run: trigger, agents, assignments, AI decisions vs. software tool runs, results | `/activity` |
| **AI Readiness Agent** | Checks readiness per capability (8 capabilities, 4 statuses), shows evidence and missing items, offers "Fix This Now", re-checks automatically, keeps history | Deterministic rules in `lib/readiness/rules.ts`; history in `readiness_assessments` / `capability_status`; the AI explains but never overrides |
| **Smart Data Importer** | CSV/XLSX upload → AI-suggested column mapping → owner confirms → normalized records with source row references; asks about ambiguous statuses; saves mappings | `lib/import/*`; OpenAI structured output for interpretation, code for validation; rule-based fallback when live AI is off (labeled) |
| **Sales Intelligence Agent** | Pipeline, missed follow-ups, stalled proposals, trends, appointment capacity, follow-up drafts, tasks | `lib/calc/sales.ts` + tools in `lib/agents/tools.ts` |
| **Financial Intelligence Agent** | Overdue invoices, balances, payment recording, expense trends, cash scenarios (refuses without enough data), reminder drafts | `lib/calc/finance.ts` + tools |
| **AI Advisor** | One chat that routes to all tools, remembers the conversation, shows every real tool action | `lib/agents/loop.ts`, `app/api/agent` (streams steps) |
| **Action Center** | Tasks from all agents (priority, explanation, records, assignee, status, completion date, dismissal reason), draft review/edit/approve/export, approvals for sensitive agent actions | `app/(app)/actions` |
| **Manual path** | Weekly totals for paper-based businesses (salon) with capacity analysis and no invented customers | `manual_weekly_entries` |
| **Sponsor Dashboard** | Aggregate enrollment, readiness, activation, adoption, action completion; counts only; multi-sponsor | `lib/services/sponsor.ts`, view `sponsor_business_progress` |
| **Demo Mode** | Reset, run scan, show activity, review findings/actions, apply a sample change (payment / contact), follow-up scan, 7-scene presentation guide | header control on sample businesses; `app/api/demo/*` |

### The demo businesses (fictional)

- **Metro Roofing** – primary demo. Baseline has 40 estimates (with contact dates), 12 invoices (5 overdue, $31,700) and 6 months of expenses (roofing materials up ~28%), no cash on hand (a real readiness gap). The agents discover the issues themselves. "Start from scratch" restores the original onboarding walkthrough (upload → missing contact dates → fix).
- **BrightPath Consulting** – different column names (Organization, Proposal Fee, Submitted, Last Email, Stage), ambiguous "Closed" stage, 6 overdue invoices totaling **$9,200**.
- **FreshStart Cleaning** – invoices with Total Amount vs Amount Due, payments, expenses, cash on hand → cash scenarios.
- **The Beauty Lounge** – paper appointment book, weekly numbers only → unused capacity.
- **Neighborhood Kitchen** – six months of expenses with rising food costs.
- 27 additional **simulated cohort** businesses (flagged `is_cohort_sim`, no records) so the sponsor charts show program scale. The dashboard labels them and can exclude them.

Sample files are downloadable from **Data & Connections** and live in `public/samples/`.

## Running it

Requirements: Node 20+ and a Supabase project.

```bash
npm install
```

```bash
cp .env.example .env.local   # fill in Supabase URL, service-role key, SESSION_SECRET, optional OPENAI_API_KEY
```

Apply the schema (either with the Supabase CLI, or over HTTPS with the included script):

```bash
supabase link --project-ref <ref> && supabase db push
```

```bash
SUPABASE_PROJECT_REF=<ref> SUPABASE_ACCESS_TOKEN=<token> npm run db:migrate
```

Seed the fictional data, then start:

```bash
npm run seed
```

```bash
npm run dev
```

Open http://localhost:3000, choose **Open the Metro Roofing demo**, then use **Demo Mode → Run AI Intelligence Scan**.

### Modes

- **Sample Data Mode** – every sample business is labeled; all calculations, readiness checks and record updates genuinely run.
- **Live AI Mode** – set `OPENAI_API_KEY`. The header shows "Live AI: on" and the model name; agent answers show "live model: …" and each real tool call. Without a key the header shows "Live AI: unavailable", agent panels explain why, and the importer labels its suggestions as rule-based. Nothing pretends to be AI.

`DEMO_TODAY` (default `2026-11-08`) pins "today" so the sample numbers stay stable.

## Tests

```bash
npm test
```

55 unit tests cover dates/money parsing, the $62,000 / 11-estimate case, $9,200 and $31,700 overdue totals (balance, not total), payments reducing balances, expense trends, cash-forecast refusal, every readiness rule including before/after transitions and stale data, roofing vs consulting header normalization, ambiguous status handling, Total≠Amount Due, and the agent loop (tool choice, permissions, approvals, invalid args, tool errors, iteration cap, memory) using a scripted fake model.

End-to-end checks against a running, seeded server (uses Playwright):

```bash
BASE_URL=http://localhost:3000 npx tsx e2e/demo-flow.ts
```

```bash
BASE_URL=http://localhost:3000 NO_KEY_URL=http://localhost:3002 npx tsx e2e/acceptance.ts
```

```bash
BASE_URL=http://localhost:3000 NO_KEY_URL=http://localhost:3002 npx tsx e2e/intelligence-flow.ts
```

`intelligence-flow.ts` covers the proactive engine (scan, persistence, prepared work, no duplicates, payment → re-verification → follow-up scan, import trigger, readiness gating, reset, honest no-key mode). `demo-flow.ts` clicks through the original readiness walkthrough. `acceptance.ts` covers acceptance tests 2–9 (start a second server with `OPENAI_API_KEY=` on port 3002 for test 9).

## Architecture

- **Next.js 15 (App Router) + TypeScript + Tailwind v4**, shadcn-style components in `components/ui`, Recharts.
- **Supabase Postgres** (`supabase/migrations`), private Storage bucket `source-files` for original uploads.
- **OpenAI** Chat Completions with function calling (`lib/agents/run.ts`), structured outputs for column mapping.
- Server-only data layer (`lib/db`), signed session cookie (`lib/auth/session.ts`), consistent error handling (`lib/http.ts`).
- Shared business data model; each sponsor sees only its own program, so the same software can be licensed to many sponsors.

```
app/            pages and API routes
components/     UI (app/ = product components, ui/ = primitives)
lib/calc        deterministic sales/finance/date/money functions
lib/readiness   readiness rules, engine, initial report
lib/import      parsing, AI + rule mapping, normalization, validation
lib/agents      tool library, agent loop, prompts, runner
lib/services    imports, actions (tasks, drafts, payments), sponsor metrics
lib/samples     fictional datasets
supabase/       migrations
scripts/        seed, sample generation, migrations
tests/ e2e/     unit and end-to-end tests
```

See [docs/STATUS.md](docs/STATUS.md) for completed features and limitations, [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) for the sponsor demo, and [docs/SECURITY_GAPS.md](docs/SECURITY_GAPS.md) for work needed before real deployment.
