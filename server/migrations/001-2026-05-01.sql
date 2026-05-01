-- Baseline migration snapshot consolidated on 2026-05-01.
-- This replaces the old multi-file history with the current Supabase schema.

create extension if not exists pgcrypto;

create table if not exists public.approvals (
  id uuid not null default gen_random_uuid(),
  event_or_fest_id text not null,
  type text not null check (type in ('event', 'fest')),
  parent_fest_id text,
  workflow_version text not null default 'v1',
  went_live_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_action_by text,
  last_action_at timestamptz,
  organizing_department_snapshot text,
  organizing_school_snapshot text,
  submitted_by text,
  action_log jsonb not null default '[]'::jsonb,
  stages jsonb not null default '[]'::jsonb,
  organizing_campus_snapshot text,
  budget_items jsonb not null default '[]'::jsonb,
  it_requests jsonb,
  constraint approvals_pkey primary key (id)
);

create table if not exists public.attendance_status (
  id uuid not null default gen_random_uuid(),
  registration_id text not null unique,
  event_id text,
  status text check (status in ('attended', 'absent', 'pending')),
  marked_at timestamptz not null default now(),
  marked_by text,
  constraint attendance_status_pkey primary key (id)
);

create table if not exists public.caters (
  catering_id text not null,
  catering_name text not null,
  contact_details jsonb not null default '[]'::jsonb,
  campuses jsonb not null default '[]'::jsonb,
  location text,
  constraint caters_pkey primary key (catering_id)
);

create table if not exists public.cater_bookings (
  booking_id text not null,
  booked_by text not null,
  description text,
  status text not null default 'pending' check (status in ('pending', 'declined', 'accepted')),
  event_fest_id text,
  created_at timestamptz not null default now(),
  contact_details json,
  catering_id text,
  event_fest_type text check (event_fest_type in ('event', 'fest')),
  constraint cater_bookings_pkey primary key (booking_id),
  constraint cater_bookings_catering_id_fkey foreign key (catering_id) references public.caters(catering_id)
);

create table if not exists public.clubs (
  club_id uuid not null default gen_random_uuid(),
  club_name text not null,
  club_description text,
  club_banner_url text check (club_banner_url like 'https://%' or club_banner_url is null),
  club_registrations boolean not null default false,
  club_roles_available jsonb not null default '["member", "media", "operations"]'::jsonb,
  club_editors jsonb not null default '[]'::jsonb,
  club_web_link text check (club_web_link like 'https://%' or club_web_link is null),
  slug text unique,
  subtitle text,
  category text,
  type text not null default 'club' check (type in ('club', 'centre', 'cell')),
  created_at timestamptz not null default now(),
  club_campus jsonb not null default '[]'::jsonb,
  clubs_applicants jsonb,
  constraint clubs_pkey primary key (club_id)
);

create table if not exists public.contact_messages (
  id uuid not null default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text not null,
  message text not null,
  source text default 'contact',
  status text default 'new',
  handled_by uuid,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint contact_messages_pkey primary key (id)
);

create table if not exists public.fests (
  id bigint generated always as identity not null,
  created_at timestamptz not null default now(),
  fest_title text not null,
  opening_date date not null,
  closing_date date not null,
  description text not null,
  department_access jsonb not null default '[]'::jsonb,
  category text not null,
  fest_image_url text,
  contact_email text,
  contact_phone text,
  event_heads jsonb not null default '[]'::jsonb,
  created_by text,
  fest_id text unique,
  organizing_dept text,
  updated_at timestamp without time zone default now(),
  updated_by text,
  auth_uuid uuid,
  banner_url text,
  venue text,
  status text default 'published',
  pdf_url text,
  registration_deadline timestamptz,
  timeline jsonb not null default '[]'::jsonb,
  sponsors jsonb not null default '[]'::jsonb,
  social_links jsonb not null default '[]'::jsonb,
  faqs jsonb not null default '[]'::jsonb,
  campus_hosted_at text,
  allowed_campuses jsonb not null default '[]'::jsonb,
  allow_outsiders boolean default false,
  is_archived boolean default false,
  archived_at timestamptz,
  archived_by text,
  custom_fields jsonb not null default '[]'::jsonb,
  department_hosted_at text,
  is_draft boolean not null default false,
  organizing_school text check (organizing_school is null or organizing_school = any (array[
    'School of Business and Management'::text,
    'School of Commerce Finance and Accountancy'::text,
    'School of Humanities and Performing Arts'::text,
    'School of Law'::text,
    'School of Psychological Sciences, Education and Social Work'::text,
    'School of Sciences'::text,
    'School of Social Sciences'::text,
    'Clubs and Centres'::text
  ])),
  sub_heads jsonb,
  constraint fests_pkey primary key (id)
);

create table if not exists public.events (
  event_id text not null,
  title text not null,
  description text not null,
  event_date date not null,
  event_time time without time zone not null,
  category text,
  banner_url text,
  event_image_url text,
  pdf_url text,
  participants_per_team smallint default 1,
  registration_fee numeric default 0,
  claims_applicable boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz,
  department_access jsonb,
  registration_deadline date,
  whatsapp_invite_link text,
  organizer_email text not null,
  organizer_phone text not null,
  rules jsonb,
  schedule jsonb,
  prizes jsonb,
  venue text not null,
  total_participants smallint not null default 0,
  created_by jsonb,
  end_date date,
  fest text,
  organizing_dept text,
  updated_by text,
  auth_uuid uuid,
  allow_outsiders boolean default false,
  outsider_registration_fee numeric,
  outsider_max_participants integer,
  custom_fields jsonb not null default '[]'::jsonb,
  campus_hosted_at text,
  allowed_campuses jsonb not null default '[]'::jsonb,
  id uuid default gen_random_uuid(),
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_by text,
  fest_id text,
  on_spot boolean not null default false,
  min_participants integer,
  is_draft boolean not null default false,
  organizing_school text check (organizing_school is null or organizing_school = any (array[
    'School of Business and Management'::text,
    'School of Commerce Finance and Accountancy'::text,
    'School of Humanities and Performing Arts'::text,
    'School of Law'::text,
    'School of Psychological Sciences, Education and Social Work'::text,
    'School of Sciences'::text,
    'School of Social Sciences'::text,
    'Clubs and Centres'::text
  ])),
  it_info jsonb,
  feedback_sent_at timestamptz,
  volunteers jsonb not null default '[]'::jsonb check (jsonb_typeof(volunteers) = 'array'),
  end_time time without time zone,
  blog_link text,
  external_speakers jsonb,
  event_summary text,
  target_audience text,
  iqac_event_type text,
  organising_committee jsonb,
  constraint events_pkey primary key (event_id),
  constraint fk_events_fest_id foreign key (fest_id) references public.fests(fest_id)
);

create table if not exists public.feedbacks (
  id uuid not null default gen_random_uuid(),
  event_id text not null unique,
  data jsonb not null default '{}'::jsonb,
  constraint feedbacks_pkey primary key (id),
  constraint fk_feedbacks_event foreign key (event_id) references public.events(event_id)
);

create table if not exists public.notifications (
  id uuid not null default gen_random_uuid(),
  user_email text,
  title text not null,
  message text,
  type text,
  read boolean default false,
  created_at timestamptz default now(),
  event_id text,
  event_title text,
  action_url text,
  is_broadcast boolean default false,
  constraint notifications_pkey primary key (id)
);

create table if not exists public.notification_user_status (
  id uuid not null default gen_random_uuid(),
  notification_id uuid not null,
  user_email text not null,
  is_read boolean not null default false,
  is_dismissed boolean not null default false,
  created_at timestamptz not null default now(),
  constraint notification_user_status_pkey primary key (id),
  constraint fk_notification_user_status_notification_id foreign key (notification_id) references public.notifications(id)
);

create table if not exists public.qr_scan_logs (
  id uuid not null default gen_random_uuid(),
  registration_id text,
  event_id text,
  scanned_by text,
  scan_timestamp timestamptz not null default now(),
  scan_result text,
  scanner_info jsonb,
  constraint qr_scan_logs_pkey primary key (id)
);

create table if not exists public.registrations (
  id uuid not null default gen_random_uuid(),
  registration_id text not null unique,
  event_id text,
  user_email text,
  registration_type text check (registration_type in ('individual', 'team')),
  individual_name text,
  individual_email text,
  individual_register_number text,
  team_name text,
  team_leader_name text,
  team_leader_email text,
  team_leader_register_number text,
  teammates jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  qr_code_data jsonb,
  qr_code_generated_at timestamptz,
  participant_organization text default 'christ_member' check (participant_organization in ('christ_member', 'outsider')),
  custom_field_responses jsonb default '{}'::jsonb,
  register_id text,
  constraint registrations_pkey primary key (id),
  constraint fk_registrations_event_id foreign key (event_id) references public.events(event_id)
);

create table if not exists public.stall_booking (
  stall_id uuid not null default gen_random_uuid(),
  description jsonb,
  requested_by text not null,
  event_fest_id text,
  created_at timestamptz not null default now(),
  campus text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  constraint stall_booking_pkey primary key (stall_id)
);

create table if not exists public.users (
  id bigint generated always as identity not null unique,
  created_at timestamptz not null default now(),
  name text,
  register_number text not null,
  email text not null unique,
  course text,
  department text,
  campus text,
  is_organiser boolean not null default false,
  avatar_url text,
  auth_uuid uuid,
  is_support boolean default false,
  is_masteradmin boolean default false,
  organiser_expires_at timestamptz,
  support_expires_at timestamptz,
  masteradmin_expires_at timestamptz,
  organization_type text default 'christ_member' check (organization_type in ('christ_member', 'outsider')),
  visitor_id text,
  outsider_name_edit_used boolean default false,
  updated_at timestamptz default now(),
  school text,
  is_hod boolean not null default false,
  is_dean boolean not null default false,
  is_cfo boolean not null default false,
  is_campus_director boolean not null default false,
  is_accounts_office boolean not null default false,
  is_it_support boolean not null default false,
  is_venue_manager boolean not null default false,
  is_stalls boolean not null default false,
  caters jsonb,
  constraint users_pkey primary key (register_number)
);

create table if not exists public.venue_bookings (
  id uuid not null default gen_random_uuid(),
  venue_id text not null,
  requested_by text not null,
  date text not null,
  start_time text not null,
  end_time text not null,
  title text not null,
  headcount integer,
  setup_notes text,
  entity_type text not null default 'standalone' check (entity_type in ('standalone', 'event', 'fest')),
  entity_id text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'returned_for_revision')),
  decision_notes text,
  created_at timestamptz not null default now(),
  constraint venue_bookings_pkey primary key (id)
);

create table if not exists public.venues (
  venue_id text not null,
  campus text not null,
  name text not null,
  capacity integer,
  location text,
  is_active boolean not null default true,
  is_event_or_venue character varying,
  is_approval_needed boolean,
  constraint venues_pkey primary key (venue_id)
);

create table if not exists public.workflow_config (
  id uuid not null default gen_random_uuid(),
  step_key text not null unique,
  step_label text not null,
  stage_bucket integer not null check (stage_bucket in (1, 2)),
  order_index integer not null,
  is_blocking boolean not null default true,
  applies_to text[] not null default array['fest'::text, 'standalone_event'::text, 'under_fest_event'::text],
  can_inherit_from_fest boolean not null default false,
  enabled boolean not null default true,
  constraint workflow_config_pkey primary key (id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_approvals_updated_at on public.approvals;
create trigger trg_approvals_updated_at
before update on public.approvals
for each row execute function public.set_updated_at();

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists trg_fests_updated_at on public.fests;
create trigger trg_fests_updated_at
before update on public.fests
for each row execute function public.set_updated_at();

drop trigger if exists trg_events_updated_at on public.events;
create trigger trg_events_updated_at
before update on public.events
for each row execute function public.set_updated_at();

create unique index if not exists idx_users_visitor_id on public.users(visitor_id) where visitor_id is not null;
create index if not exists idx_users_created_at on public.users(created_at desc);
create index if not exists idx_users_email_lower on public.users((lower(email)));
create index if not exists idx_users_name_lower on public.users((lower(name)));
create index if not exists idx_users_roles on public.users(is_organiser, is_support, is_masteradmin);
create index if not exists idx_users_department on public.users(department);
create index if not exists idx_users_campus on public.users(campus);
create index if not exists idx_users_school on public.users(school);
create index if not exists idx_users_is_hod on public.users(is_hod) where is_hod = true;
create index if not exists idx_users_is_dean on public.users(is_dean) where is_dean = true;

create index if not exists idx_approvals_event_or_fest_id on public.approvals(event_or_fest_id);
create index if not exists idx_approvals_type on public.approvals(type);
create index if not exists idx_approvals_parent_fest_id on public.approvals(parent_fest_id) where parent_fest_id is not null;

create index if not exists idx_events_created_at on public.events(created_at desc);
create index if not exists idx_events_event_date on public.events(event_date desc);
create index if not exists idx_events_title_lower on public.events((lower(title)));
create index if not exists idx_events_dept_lower on public.events((lower(organizing_dept)));
create index if not exists idx_events_fest_id on public.events(fest_id);
create index if not exists idx_events_is_archived on public.events(is_archived);
create index if not exists idx_events_archived_at on public.events(archived_at desc);
create index if not exists idx_events_on_spot on public.events(on_spot);
create index if not exists idx_events_campus_hosted_at on public.events(campus_hosted_at);
create index if not exists idx_events_organizing_school on public.events(organizing_school);

create index if not exists idx_fests_created_at on public.fests(created_at desc);
create index if not exists idx_fests_opening_date on public.fests(opening_date desc);
create index if not exists idx_fests_title_lower on public.fests((lower(fest_title)));
create index if not exists idx_fests_dept_lower on public.fests((lower(organizing_dept)));
create index if not exists idx_fests_allow_outsiders on public.fests(allow_outsiders);
create index if not exists idx_fests_department_hosted_at on public.fests(department_hosted_at);
create index if not exists idx_fests_is_archived on public.fests(is_archived);
create index if not exists idx_fests_archived_at on public.fests(archived_at desc);
create index if not exists idx_fests_organizing_school on public.fests(organizing_school);

create index if not exists idx_registrations_event_id on public.registrations(event_id);
create index if not exists idx_registrations_user_email on public.registrations(user_email);

create index if not exists idx_attendance_event_id on public.attendance_status(event_id);
create index if not exists idx_attendance_registration_id on public.attendance_status(registration_id);

create index if not exists idx_notifications_user_read_created on public.notifications(user_email, read, created_at desc);

create index if not exists idx_notification_user_status_user_email on public.notification_user_status(user_email);
create index if not exists idx_notification_user_status_notification_id on public.notification_user_status(notification_id);
create index if not exists idx_notification_user_status_is_read on public.notification_user_status(is_read);

create index if not exists idx_cater_bookings_event_fest_id on public.cater_bookings(event_fest_id);
create index if not exists idx_cater_bookings_event_fest_type on public.cater_bookings(event_fest_type);
create index if not exists idx_cater_bookings_catering_id on public.cater_bookings(catering_id);
create index if not exists idx_caters_campuses on public.caters using gin(campuses);

create index if not exists idx_stall_booking_requested_by on public.stall_booking(requested_by);
create index if not exists idx_stall_booking_event_fest_id on public.stall_booking(event_fest_id);
create index if not exists idx_stall_booking_campus on public.stall_booking(campus);
create index if not exists idx_stall_booking_status on public.stall_booking(status);

create index if not exists idx_venue_bookings_venue_date on public.venue_bookings(venue_id, date);
create index if not exists idx_venue_bookings_requested_by on public.venue_bookings(requested_by);
create index if not exists idx_venue_bookings_status on public.venue_bookings(status);
create index if not exists idx_venues_campus on public.venues(campus);

create index if not exists idx_feedbacks_event_id on public.feedbacks(event_id);

do $$
declare
  tbl text;
  tables text[] := array[
    'approvals',
    'attendance_status',
    'cater_bookings',
    'caters',
    'clubs',
    'contact_messages',
    'events',
    'feedbacks',
    'fests',
    'notification_user_status',
    'notifications',
    'qr_scan_logs',
    'registrations',
    'stall_booking',
    'users',
    'venue_bookings',
    'venues',
    'workflow_config'
  ];
begin
  foreach tbl in array tables loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('drop policy if exists %I on public.%I', 'allow_all_access', tbl);
    execute format('create policy %I on public.%I for all using (true) with check (true)', 'allow_all_access', tbl);
  end loop;
end $$;