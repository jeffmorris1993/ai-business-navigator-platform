# Security work needed before a real deployment

This is a working prototype built for sponsor demonstrations with **fictional data**. The items below must be addressed before any real business data is loaded.

## What the prototype already does

- All database access happens on the server with the Supabase service-role key; the key never reaches the browser. Row Level Security is enabled on every table with **no** public policies, so the anon key can read nothing.
- Every query and every agent tool is scoped by the `businessId` from the signed server session. The AI model never chooses which business it is working on; tool arguments cannot change it.
- Sponsor sessions can call only the aggregate metrics endpoint. Record pages redirect and record APIs return 401 (verified by `e2e/acceptance.ts`, test 8). Sponsor metrics contain counts only, and groups under 3 are combined.
- Agent tools validate input with zod schemas, are restricted per agent (Sales can't record payments; Finance can't edit opportunities), have a per-tool timeout and an 8-iteration cap, and sensitive tools (record payment, approve draft, update record) only run after the owner clicks Approve.
- Uploaded files are treated as untrusted: 5 MB / 5,000 row / 50 column caps, `.xls` refused, formulas never evaluated (cached results only), values truncated, and the AI is told file contents are data, not instructions. Originals are stored in a private Supabase Storage bucket and served only to the owning business.
- Financial math, dates and readiness decisions are deterministic code with unit tests; the model only explains.
- No messages are ever sent. Drafts are approved and copied/exported by the owner.

## Gaps to close

1. **Real authentication.** The demo "sign in as a sample business / sponsor" picker is not authentication. Replace with Supabase Auth (or SSO for sponsors), user↔business membership tables, roles (owner, staff, sponsor admin), and invitation flows.
2. **Per-user RLS.** Move from service-role queries to user-scoped Supabase clients with RLS policies keyed to membership, so a server bug can't cross tenants. Keep the service role for background jobs only.
3. **Sponsor data contracts.** Formal consent from each business for aggregate reporting, documented k-anonymity thresholds, and audit of every sponsor query.
4. **Secrets.** Rotate the Supabase service-role key and OpenAI key used during development. Store secrets in the hosting provider's secret manager; set `SESSION_SECRET` per environment.
5. **AI data handling.** Review OpenAI data-retention settings / zero-retention agreements; minimize what is sent (the importer sends headers + 6 truncated sample rows; agents send tool results). Add PII redaction options and per-business opt-out of live AI.
6. **Prompt-injection hardening.** Add output filtering for links/instructions echoed from records, and red-team tests with malicious spreadsheet content.
7. **Upload scanning.** Malware scanning for stored files, content-type sniffing, and retention/deletion policies for originals.
8. **Rate limiting and abuse controls** on agent and import endpoints; per-business AI spend limits.
9. **Audit logging.** Agent runs and steps are logged; extend to all record changes with actor identity, and make logs tamper-evident.
10. **Compliance review.** The readiness questionnaire records the owner's answers; it is not a security or legal assessment, and the UI says so. A real deployment needs privacy policy, terms, DPA, and an accessibility review.
11. **Operational.** Backups, monitoring, error tracking (no PII in logs), dependency scanning (`npm audit` currently reports advisories in transitive dev dependencies), CSP headers.
