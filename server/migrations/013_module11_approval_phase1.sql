-- Migration 013: Module 11 Phase 1 – Approval Workflow
-- Adds: new role flags on users, approvals table, workflow_config table
-- Safe to run multiple times (all DDL uses IF NOT EXISTS / IF EXISTS guards)

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------
-- USERS – new approval role flags
-- -----------------------------------------------------------------
alter table if exists public.users
  add column if not exists is_hod             boolean not null default false,
  add column if not exists is_dean            boolean not null default false,
  add column if not exists is_cfo             boolean not null default false,
  add column if not exists is_campus_director boolean not null default false,
  add column if not exists is_accounts_office boolean not null default false,
  add column if not exists is_it_support      boolean not null default false,
  add column if not exists is_vendor_manager  boolean not null default false,
  add column if not exists is_stalls          boolean not null default false,
  add column if not exists school             text;

-- -----------------------------------------------------------------
-- APPROVALS table
-- -----------------------------------------------------------------
create table if not exists public.approvals (
  id                              uuid primary key default gen_random_uuid(),
  event_or_fest_id                text not null,
  type                            text not null check (type in ('event', 'fest')),

  -- Stage 1 blocking steps (column names per spec)
  stage1_hod                      text not null default 'pending'
                                    check (stage1_hod in ('pending','approved','rejected','skipped')),
  stage2_dean                     text not null default 'pending'
                                    check (stage2_dean in ('pending','approved','rejected','skipped')),
  stage3_cfo                      text not null default 'pending'
                                    check (stage3_cfo in ('pending','approved','rejected','skipped')),
  stage4_accounts                 text not null default 'pending'
                                    check (stage4_accounts in ('pending','approved','rejected','skipped')),

  -- Stage 2 operational lanes
  catering_approval               text not null default 'pending'
                                    check (catering_approval in ('pending','approved','rejected','skipped')),
  it_support_approval             text not null default 'pending'
                                    check (it_support_approval in ('pending','approved','rejected','skipped')),
  stalls_approval                 text not null default 'pending'
                                    check (stalls_approval in ('pending','approved','rejected','skipped')),
  venue_approval                  text not null default 'pending'
                                    check (venue_approval in ('pending','approved','rejected','skipped')),
  miscellaneous_approval          text not null default 'pending'
                                    check (miscellaneous_approval in ('pending','approved','rejected','skipped')),

  -- Workflow metadata
  parent_fest_id                  text,
  workflow_version                text not null default 'v1',
  current_stage                   integer not null default 1 check (current_stage in (1, 2)),
  went_live_at                    timestamptz,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now(),
  last_action_by                  text,
  last_action_at                  timestamptz,
  organizing_department_snapshot  text,
  organizing_school_snapshot      text,
  submitted_by                    text,

  -- HOD assignee tracking (Phase 1)
  stage1_hod_assignee_user_id     uuid,
  stage1_hod_routing_state        text not null default 'waiting_for_assignment'
                                    check (stage1_hod_routing_state in ('assigned','waiting_for_assignment')),

  -- Dean assignee tracking (Phase 1)
  stage2_dean_assignee_user_id    uuid,
  stage2_dean_routing_state       text not null default 'waiting_for_assignment'
                                    check (stage2_dean_routing_state in ('assigned','waiting_for_assignment')),

  -- Audit log: array of {step, action, by, byEmail, at, note, is_override}
  action_log                      jsonb not null default '[]'::jsonb,

  unique (event_or_fest_id, type)
);

-- -----------------------------------------------------------------
-- WORKFLOW_CONFIG table (dropdown-driven configuration)
-- -----------------------------------------------------------------
create table if not exists public.workflow_config (
  id                  uuid primary key default gen_random_uuid(),
  step_key            text unique not null,
  step_label          text not null,
  stage_bucket        integer not null check (stage_bucket in (1, 2)),
  order_index         integer not null,
  is_blocking         boolean not null default true,
  applies_to          text[] not null default array['fest','standalone_event','under_fest_event'],
  can_inherit_from_fest boolean not null default false,
  enabled             boolean not null default true
);

-- Seed default workflow config (skip if rows already exist)
insert into public.workflow_config (step_key, step_label, stage_bucket, order_index, is_blocking, applies_to, can_inherit_from_fest, enabled)
select step_key, step_label, stage_bucket, order_index, is_blocking, applies_to, can_inherit_from_fest, enabled
from (values
  ('hod',        'HOD',              1, 1, true,  array['fest','standalone_event']::text[],                            false, true),
  ('dean',       'Dean',             1, 2, true,  array['fest','standalone_event']::text[],                            false, true),
  ('cfo',        'CFO/Campus Dir',   1, 3, true,  array['fest','standalone_event']::text[],                            false, true),
  ('accounts',   'Accounts Office',  1, 4, true,  array['fest','standalone_event']::text[],                            false, true),
  ('it',         'IT Support',       2, 1, false, array['fest','standalone_event','under_fest_event']::text[],         true,  true),
  ('venue',      'Venue',            2, 2, false, array['fest','standalone_event','under_fest_event']::text[],         true,  true),
  ('catering',   'Catering Vendors', 2, 3, false, array['fest','standalone_event','under_fest_event']::text[],         true,  true),
  ('stalls',     'Stalls/Misc',      2, 4, false, array['fest','standalone_event','under_fest_event']::text[],         true,  true),
  ('volunteers', 'Volunteers',       2, 5, false, array['fest','standalone_event','under_fest_event']::text[],         true,  true)
) as v(step_key, step_label, stage_bucket, order_index, is_blocking, applies_to, can_inherit_from_fest, enabled)
where not exists (select 1 from public.workflow_config where workflow_config.step_key = v.step_key);

-- -----------------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------------
do $$
begin
  if to_regclass('public.users') is not null then
    execute 'create index if not exists idx_users_is_hod  on public.users(is_hod)  where is_hod  = true';
    execute 'create index if not exists idx_users_is_dean on public.users(is_dean) where is_dean = true';
    execute 'create index if not exists idx_users_school  on public.users(school)  where school  is not null';
  end if;

  if to_regclass('public.approvals') is not null then
    execute 'create index if not exists idx_approvals_event_or_fest_id on public.approvals(event_or_fest_id)';
    execute 'create index if not exists idx_approvals_type             on public.approvals(type)';
    execute 'create index if not exists idx_approvals_parent_fest_id  on public.approvals(parent_fest_id) where parent_fest_id is not null';
    execute 'create index if not exists idx_approvals_current_stage   on public.approvals(current_stage)';
    execute 'create index if not exists idx_approvals_stage1_hod      on public.approvals(stage1_hod)';
    execute 'create index if not exists idx_approvals_stage2_dean     on public.approvals(stage2_dean)';
    execute 'create index if not exists idx_approvals_submitted_by    on public.approvals(submitted_by)';
    execute 'create index if not exists idx_approvals_hod_assignee    on public.approvals(stage1_hod_assignee_user_id) where stage1_hod_assignee_user_id is not null';
    execute 'create index if not exists idx_approvals_dean_assignee   on public.approvals(stage2_dean_assignee_user_id) where stage2_dean_assignee_user_id is not null';
    execute 'create index if not exists idx_approvals_hod_routing     on public.approvals(stage1_hod_routing_state)';
    execute 'create index if not exists idx_approvals_dean_routing    on public.approvals(stage2_dean_routing_state)';
  end if;
end $$;

-- -----------------------------------------------------------------
-- Verification
-- -----------------------------------------------------------------
select 'users.is_hod' as check_name,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'is_hod'
  ) as ok
union all
select 'approvals table' as check_name,
  exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'approvals'
  ) as ok
union all
select 'workflow_config table' as check_name,
  exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'workflow_config'
  ) as ok;
