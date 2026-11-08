-- Add the simulated-cohort flag to the sponsor aggregate view so dashboards can include/exclude it.
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
  (select count(*) from events e where e.business_id = b.id and e.kind = 'record_quality_improved') as quality_improvements,
  b.is_cohort_sim
from businesses b
left join latest l on l.business_id = b.id
left join first_a f on f.business_id = b.id;
