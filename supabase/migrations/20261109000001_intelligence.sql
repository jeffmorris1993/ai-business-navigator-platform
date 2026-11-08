-- Sirrom Intelligence Engine: scans, persistent findings, links from prepared work to findings.

create table intelligence_scans (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  trigger text not null check (trigger in ('manual','import','follow_up','software_only')),
  scope text[] not null default '{}',
  status text not null default 'running' check (status in ('running','completed','failed')),
  mode text not null default 'ai' check (mode in ('ai','software_only')),
  objective text,
  summary text,
  model text,
  error text,
  findings_new int not null default 0,
  findings_updated int not null default 0,
  findings_resolved int not null default 0,
  drafts_prepared int not null default 0,
  tasks_created int not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index on intelligence_scans (business_id, started_at desc);
-- At most one running scan per business (duplicate-run lock).
create unique index intelligence_scans_one_running on intelligence_scans (business_id) where status = 'running';

create table findings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  agent text not null check (agent in ('readiness','sales','finance','software')),
  category text not null,
  title text not null,
  explanation text not null,
  priority text not null default 'medium' check (priority in ('critical','high','medium','low')),
  record_refs jsonb not null default '[]'::jsonb,
  subject text,
  value numeric(14,2),
  value_kind text not null default 'none' check (value_kind in ('potential_pipeline','outstanding_balance','expense_change','capacity_value','none')),
  evidence_quality text not null default 'verified_records' check (evidence_quality in ('verified_records','partial_records','owner_reported')),
  recommended_action text,
  status text not null default 'new' check (status in ('new','needs_review','action_prepared','in_progress','resolved','dismissed')),
  dedupe_key text not null,
  resolution_note text,
  resolved_by text check (resolved_by in ('software_verified','ai_scan','owner')),
  dismissed_reason text,
  source_scan_id uuid references intelligence_scans(id) on delete set null,
  source_run_id uuid references agent_runs(id) on delete set null,
  updated_by_run_id uuid references agent_runs(id) on delete set null,
  times_verified int not null default 1,
  created_at timestamptz not null default now(),
  last_verified_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index on findings (business_id, status);
create unique index findings_open_dedupe on findings (business_id, dedupe_key) where status not in ('resolved','dismissed');

alter table tasks add column if not exists finding_id uuid references findings(id) on delete set null;
alter table drafts add column if not exists finding_id uuid references findings(id) on delete set null;
alter table pending_actions add column if not exists finding_id uuid references findings(id) on delete set null;
alter table agent_runs add column if not exists scan_id uuid references intelligence_scans(id) on delete set null;
alter table agent_runs add column if not exists parent_run_id uuid references agent_runs(id) on delete set null;

alter table intelligence_scans enable row level security;
alter table findings enable row level security;

-- Sponsor view: add counts that separate AI-prepared work, owner approvals and software-verified outcomes.
drop view if exists sponsor_business_progress;
create view sponsor_business_progress with (security_invoker = true) as
with latest as (
  select distinct on (business_id) business_id, id as assessment_id
  from readiness_assessments order by business_id, run_at desc
), first_a as (
  select distinct on (business_id) business_id, id as assessment_id
  from readiness_assessments order by business_id, run_at asc
)
select
  b.sponsor_id,
  b.id as business_ref,
  b.onboarded,
  b.industry,
  b.enrolled_at,
  (select count(*) from capability_status c where c.assessment_id = l.assessment_id and c.status = 'ready') as ready_now,
  (select count(*) from capability_status c where c.assessment_id = f.assessment_id and c.status = 'ready') as ready_at_start,
  (l.assessment_id is not null) as assessed,
  exists (select 1 from agent_runs r where r.business_id = b.id and r.agent in ('sales','advisor','orchestrator') and r.status='completed') as used_sales_agent,
  exists (select 1 from agent_runs r where r.business_id = b.id and r.agent in ('finance','orchestrator') and r.status='completed') as used_finance_agent,
  (select count(*) from tasks t where t.business_id = b.id) as tasks_total,
  (select count(*) from tasks t where t.business_id = b.id and t.status = 'done') as tasks_done,
  (select count(*) from events e where e.business_id = b.id and e.kind = 'record_quality_improved') as quality_improvements,
  b.is_cohort_sim,
  (select count(*) from intelligence_scans s where s.business_id = b.id and s.status = 'completed') as scans_completed,
  (select count(*) from findings x where x.business_id = b.id) as findings_total,
  (select count(*) from findings x where x.business_id = b.id and x.resolved_by = 'software_verified') as findings_verified_resolved,
  (select count(*) from drafts d where d.business_id = b.id and d.finding_id is not null) + (select count(*) from tasks t where t.business_id = b.id and t.finding_id is not null) as ai_prepared_actions,
  (select count(*) from drafts d where d.business_id = b.id and d.status = 'approved') + (select count(*) from pending_actions p where p.business_id = b.id and p.status = 'approved') as owner_approved_actions
from businesses b
left join latest l on l.business_id = b.id
left join first_a f on f.business_id = b.id;
