-- Migration 015: Campus matching for approval routing
-- Safe to re-run — all statements are idempotent.

begin;

alter table public.approvals
  add column if not exists organizing_campus_snapshot text;

drop index if exists idx_approvals_campus_snapshot;
drop index if exists idx_users_department;
drop index if exists idx_users_campus;

create index idx_approvals_campus_snapshot on approvals (organizing_campus_snapshot);
create index idx_users_department           on users     (department);
create index idx_users_campus               on users     (campus);

select 'organizing_campus_snapshot on approvals' as check_name,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'approvals'
      and column_name = 'organizing_campus_snapshot'
  ) as ok
union all
select 'department column exists on users',
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users'
      and column_name = 'department'
  );

commit;
