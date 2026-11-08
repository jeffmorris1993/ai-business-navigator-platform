-- Sirrom Business AI Navigator: core schema
-- All business data is scoped by business_id. The app talks to the database only
-- from the server with the service-role key; RLS is enabled with no public policies,
-- so the anon key cannot read anything.

create extension if not exists pgcrypto;

create table sponsors (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  program_name text not null,
  accent_color text not null default '#4f46e5',
  created_at timestamptz not null default now()
);

create table businesses (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  sponsor_id uuid references sponsors(id) on delete set null,
  name text not null,
  industry text,
  sales_tracking text,
  invoicing text,
  biggest_challenge text,
  ai_experience text,
  main_goal text,
  data_path text not null default 'spreadsheet' check (data_path in ('spreadsheet','manual')),
  onboarded boolean not null default false,
  is_sample boolean not null default true,
  is_cohort_sim boolean not null default false, -- simulated cohort member for sponsor charts (no records)
  enrolled_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Five readiness areas questionnaire (process, technology, people, privacy). Free-form but typed keys.
create table business_profile_answers (
  business_id uuid primary key references businesses(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table source_files (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  filename text not null,
  storage_path text,
  sha256 text not null,
  record_type text not null,
  row_count int not null default 0,
  import_mode text not null default 'append',
  uploaded_at timestamptz not null default now()
);

create table column_mappings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  record_type text not null,
  header_signature text not null,
  mapping jsonb not null,
  status_map jsonb not null default '{}'::jsonb,
  suggested_by text not null default 'ai',
  confirmed_at timestamptz not null default now(),
  unique (business_id, record_type, header_signature)
);

create table sales_opportunities (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  source_file_id uuid references source_files(id) on delete set null,
  source_row int,
  customer text,
  amount numeric(14,2),
  quoted_on date,
  last_contact_on date,
  last_contact_unknown boolean not null default false,
  status text not null default 'unknown' check (status in ('open','won','lost','unknown')),
  raw_status text,
  raw jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index on sales_opportunities (business_id);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  source_file_id uuid references source_files(id) on delete set null,
  source_row int,
  invoice_no text,
  customer text,
  issued_on date,
  due_on date,
  total_amount numeric(14,2),
  amount_due numeric(14,2),
  raw jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index on invoices (business_id);

create table payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  invoice_id uuid references invoices(id) on delete cascade,
  source_file_id uuid references source_files(id) on delete set null,
  source_row int,
  amount numeric(14,2) not null check (amount > 0),
  paid_on date not null,
  note text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on payments (business_id);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  source_file_id uuid references source_files(id) on delete set null,
  source_row int,
  spent_on date,
  category text,
  vendor text,
  amount numeric(14,2),
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on expenses (business_id);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  source_file_id uuid references source_files(id) on delete set null,
  source_row int,
  client text,
  scheduled_on date,
  service text,
  amount numeric(14,2),
  status text not null default 'unknown' check (status in ('booked','completed','cancelled','no_show','unknown')),
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on appointments (business_id);

create table manual_weekly_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  week_start date not null,
  available_slots int,
  booked int,
  cancellations int,
  unfilled_slots int,
  avg_service_value numeric(10,2),
  weekly_sales numeric(14,2),
  created_at timestamptz not null default now(),
  unique (business_id, week_start)
);

create table cash_positions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  as_of date not null,
  cash_on_hand numeric(14,2) not null,
  created_at timestamptz not null default now()
);

create table readiness_assessments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  trigger text not null,
  run_at timestamptz not null default now()
);
create index on readiness_assessments (business_id, run_at desc);

create table capability_status (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references readiness_assessments(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  capability text not null,
  status text not null check (status in ('ready','partial','needs_setup','not_assessed')),
  evidence jsonb not null default '[]'::jsonb,
  missing jsonb not null default '[]'::jsonb,
  next_step text,
  fix_action text
);
create index on capability_status (business_id, capability);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  source_agent text not null check (source_agent in ('readiness','sales','finance','advisor','owner')),
  priority text not null default 'medium' check (priority in ('high','medium','low')),
  title text not null,
  explanation text,
  record_refs jsonb not null default '[]'::jsonb,
  assignee text default 'Owner',
  status text not null default 'open' check (status in ('open','in_progress','done','dismissed')),
  completed_at timestamptz,
  dismissed_reason text,
  created_at timestamptz not null default now()
);
create index on tasks (business_id);

create table drafts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  kind text not null check (kind in ('sales_followup','payment_reminder')),
  record_type text not null,
  record_id uuid not null,
  recipient text,
  subject text,
  body text not null,
  status text not null default 'draft' check (status in ('draft','approved')),
  written_by text not null default 'template',
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on drafts (business_id);

create table pending_actions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  tool text not null,
  input jsonb not null,
  summary text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  result jsonb,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  agent text not null,
  conversation_id uuid,
  question text not null,
  answer text,
  model text,
  status text not null default 'running' check (status in ('running','completed','failed')),
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index on agent_runs (business_id, started_at desc);

create table agent_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references agent_runs(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  step_no int not null,
  kind text not null check (kind in ('model_call','tool_call')),
  tool text,
  input jsonb,
  output_summary text,
  output jsonb,
  ok boolean not null default true,
  duration_ms int,
  created_at timestamptz not null default now()
);
create index on agent_steps (run_id, step_no);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  messages jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on events (business_id, created_at desc);

-- Enable RLS everywhere; no policies = no access for anon/authenticated roles.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Sponsor-facing aggregate: counts only. No names, customers, amounts or record ids.
create or replace view sponsor_business_progress with (security_invoker = true) as
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
  exists (select 1 from agent_runs r where r.business_id = b.id and r.agent in ('sales','advisor') and r.status='completed') as used_sales_agent,
  exists (select 1 from agent_runs r where r.business_id = b.id and r.agent = 'finance' and r.status='completed') as used_finance_agent,
  (select count(*) from tasks t where t.business_id = b.id) as tasks_total,
  (select count(*) from tasks t where t.business_id = b.id and t.status = 'done') as tasks_done,
  (select count(*) from events e where e.business_id = b.id and e.kind = 'record_quality_improved') as quality_improvements
from businesses b
left join latest l on l.business_id = b.id
left join first_a f on f.business_id = b.id;

insert into storage.buckets (id, name, public) values ('source-files', 'source-files', false)
on conflict (id) do nothing;
