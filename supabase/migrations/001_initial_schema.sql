-- ================================================================
-- Kin — Initial Schema
-- Run once in Supabase SQL Editor.
-- ================================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ================================================================
-- 1. TABLES
-- ================================================================

-- facilities
create table if not exists public.facilities (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  address     text,
  phone       text,
  created_at  timestamptz not null default now()
);

-- profiles (maps 1:1 to auth.users)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  facility_id uuid not null references public.facilities(id) on delete cascade,
  email       text not null,
  full_name   text not null,
  role        text not null check (role in ('family','staff','nurse','admin','director')),
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- residents
create table if not exists public.residents (
  id                  uuid primary key default gen_random_uuid(),
  facility_id         uuid not null references public.facilities(id) on delete cascade,
  full_name           text not null,
  room_number         text,
  photo_url           text,
  date_of_birth       date,
  admission_date      date,
  pcc_resident_id     text,           -- PointClickCare external ID
  tabula_resident_id  text,           -- Tabula Pro external ID
  is_active           boolean not null default true,
  created_at          timestamptz not null default now()
);

-- family_residents (many-to-many)
create table if not exists public.family_residents (
  id                  uuid primary key default gen_random_uuid(),
  profile_id          uuid not null references public.profiles(id) on delete cascade,
  resident_id         uuid not null references public.residents(id) on delete cascade,
  relationship        text,
  is_primary_contact  boolean not null default false,
  created_at          timestamptz not null default now(),
  unique (profile_id, resident_id)
);

-- care_events (EHR-ingested events)
create table if not exists public.care_events (
  id               uuid primary key default gen_random_uuid(),
  facility_id      uuid not null references public.facilities(id) on delete cascade,
  resident_id      uuid not null references public.residents(id) on delete cascade,
  source           text not null check (source in ('pointclickcare','tabulapro','matrixcare','staff')),
  source_record_id text not null,
  event_type       text not null,
  title            text not null,
  detail           text,
  occurred_at      timestamptz not null,
  severity         text not null default 'info' check (severity in ('info','warning','critical','incident')),
  metadata         jsonb,
  created_at       timestamptz not null default now(),
  unique (source, source_record_id)
);

-- tickets
create table if not exists public.tickets (
  id               uuid primary key default gen_random_uuid(),
  facility_id      uuid not null references public.facilities(id) on delete cascade,
  resident_id      uuid not null references public.residents(id) on delete cascade,
  created_by       uuid not null references public.profiles(id),
  assigned_to      uuid references public.profiles(id),
  linked_event_id  uuid references public.care_events(id),
  title            text not null,
  body             text not null,
  category         text not null check (category in ('question','concern','complaint','care_plan','administrative','compliment','incident')),
  priority         text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status           text not null default 'open' check (status in ('open','assigned','in_progress','pending_family','resolved','closed')),
  due_by           timestamptz,       -- auto-set by trigger on insert
  first_response_at timestamptz,
  resolved_at      timestamptz,
  resolution_note  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ticket_messages
create table if not exists public.ticket_messages (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.tickets(id) on delete cascade,
  author_id   uuid not null references public.profiles(id),
  body        text not null,
  is_internal boolean not null default false,
  created_at  timestamptz not null default now()
);

-- audit_log (append-only — no UPDATE or DELETE policies)
create table if not exists public.audit_log (
  id           uuid primary key default gen_random_uuid(),
  facility_id  uuid references public.facilities(id) on delete cascade,
  actor_id     uuid references public.profiles(id) on delete set null,
  action       text not null,
  entity_type  text not null,
  entity_id    uuid,
  before_state jsonb,
  after_state  jsonb,
  ip_address   text,
  created_at   timestamptz not null default now()
);

-- notification_preferences
create table if not exists public.notification_preferences (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  event_type      text not null,
  email_enabled   boolean not null default true,
  sms_enabled     boolean not null default false,
  push_enabled    boolean not null default false,
  unique (profile_id, event_type)
);

-- ================================================================
-- 2. INDEXES
-- ================================================================

create index if not exists idx_care_events_resident     on public.care_events(resident_id);
create index if not exists idx_care_events_facility     on public.care_events(facility_id);
create index if not exists idx_care_events_occurred     on public.care_events(occurred_at desc);
create index if not exists idx_tickets_facility         on public.tickets(facility_id);
create index if not exists idx_tickets_resident         on public.tickets(resident_id);
create index if not exists idx_tickets_assigned         on public.tickets(assigned_to);
create index if not exists idx_tickets_status           on public.tickets(status);
create index if not exists idx_tickets_due_by           on public.tickets(due_by);
create index if not exists idx_ticket_messages_ticket   on public.ticket_messages(ticket_id);
create index if not exists idx_audit_log_facility       on public.audit_log(facility_id);
create index if not exists idx_audit_log_created        on public.audit_log(created_at desc);
create index if not exists idx_profiles_facility        on public.profiles(facility_id);
create index if not exists idx_profiles_role            on public.profiles(role);
create index if not exists idx_family_residents_profile on public.family_residents(profile_id);
create index if not exists idx_family_residents_resident on public.family_residents(resident_id);

-- ================================================================
-- 3. TRIGGERS
-- ================================================================

-- Auto-set due_by on ticket insert based on priority
create or replace function public.set_ticket_due_by()
returns trigger language plpgsql as $$
begin
  new.due_by := case new.priority
    when 'urgent' then now() + interval '4 hours'
    when 'high'   then now() + interval '12 hours'
    when 'normal' then now() + interval '24 hours'
    when 'low'    then now() + interval '72 hours'
    else               now() + interval '24 hours'
  end;
  return new;
end;
$$;

drop trigger if exists trg_ticket_due_by on public.tickets;
create trigger trg_ticket_due_by
  before insert on public.tickets
  for each row execute function public.set_ticket_due_by();

-- Auto-update updated_at on ticket update
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_tickets_updated_at on public.tickets;
create trigger trg_tickets_updated_at
  before update on public.tickets
  for each row execute function public.set_updated_at();

-- Auto-set resolved_at when status → resolved
create or replace function public.set_ticket_resolved_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'resolved' and old.status != 'resolved' then
    new.resolved_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ticket_resolved_at on public.tickets;
create trigger trg_ticket_resolved_at
  before update on public.tickets
  for each row execute function public.set_ticket_resolved_at();

-- ================================================================
-- 4. ROW LEVEL SECURITY
-- ================================================================

alter table public.facilities            enable row level security;
alter table public.profiles              enable row level security;
alter table public.residents             enable row level security;
alter table public.family_residents      enable row level security;
alter table public.care_events           enable row level security;
alter table public.tickets               enable row level security;
alter table public.ticket_messages       enable row level security;
alter table public.audit_log             enable row level security;
alter table public.notification_preferences enable row level security;

-- Helper: get calling user's profile
create or replace function public.my_profile_id()
returns uuid language sql stable as $$
  select id from public.profiles where id = auth.uid()
$$;

create or replace function public.my_facility_id()
returns uuid language sql stable as $$
  select facility_id from public.profiles where id = auth.uid()
$$;

create or replace function public.my_role()
returns text language sql stable as $$
  select role from public.profiles where id = auth.uid()
$$;

-- facilities: users can only see their own facility
create policy "facilities_own" on public.facilities
  for select using (id = public.my_facility_id());

-- profiles: users can see profiles in their facility
create policy "profiles_same_facility" on public.profiles
  for select using (facility_id = public.my_facility_id());

create policy "profiles_own_update" on public.profiles
  for update using (id = auth.uid());

-- residents: family sees only linked residents; staff/nurse/admin see all in facility
create policy "residents_staff_all" on public.residents
  for select using (
    facility_id = public.my_facility_id()
    and public.my_role() in ('staff','nurse','admin','director')
  );

create policy "residents_family_linked" on public.residents
  for select using (
    facility_id = public.my_facility_id()
    and public.my_role() = 'family'
    and id in (
      select resident_id from public.family_residents
      where profile_id = auth.uid()
    )
  );

-- family_residents: family sees own rows; staff/admin see all in facility
create policy "family_residents_own" on public.family_residents
  for select using (
    profile_id = auth.uid()
    or public.my_role() in ('staff','nurse','admin','director')
  );

-- care_events: same resident-access logic as residents
create policy "care_events_staff" on public.care_events
  for select using (
    facility_id = public.my_facility_id()
    and public.my_role() in ('staff','nurse','admin','director')
  );

create policy "care_events_family" on public.care_events
  for select using (
    facility_id = public.my_facility_id()
    and public.my_role() = 'family'
    and resident_id in (
      select resident_id from public.family_residents
      where profile_id = auth.uid()
    )
  );

-- tickets: family sees their own; staff/nurse/admin/director see all in facility
create policy "tickets_staff" on public.tickets
  for select using (
    facility_id = public.my_facility_id()
    and public.my_role() in ('staff','nurse','admin','director')
  );

create policy "tickets_family_own" on public.tickets
  for select using (
    facility_id = public.my_facility_id()
    and public.my_role() = 'family'
    and created_by = auth.uid()
  );

create policy "tickets_family_insert" on public.tickets
  for insert with check (
    facility_id = public.my_facility_id()
    and public.my_role() = 'family'
    and created_by = auth.uid()
  );

create policy "tickets_staff_update" on public.tickets
  for update using (
    facility_id = public.my_facility_id()
    and public.my_role() in ('staff','nurse','admin','director')
  );

-- ticket_messages: family sees non-internal on their tickets; staff sees all
create policy "messages_staff" on public.ticket_messages
  for select using (
    public.my_role() in ('staff','nurse','admin','director')
    and ticket_id in (
      select id from public.tickets where facility_id = public.my_facility_id()
    )
  );

create policy "messages_family" on public.ticket_messages
  for select using (
    public.my_role() = 'family'
    and is_internal = false
    and ticket_id in (
      select id from public.tickets where created_by = auth.uid()
    )
  );

create policy "messages_insert" on public.ticket_messages
  for insert with check (
    author_id = auth.uid()
    and ticket_id in (
      select id from public.tickets where facility_id = public.my_facility_id()
    )
  );

-- audit_log: only admin/director can read; NO update/delete policies (append-only)
create policy "audit_log_read" on public.audit_log
  for select using (
    facility_id = public.my_facility_id()
    and public.my_role() in ('admin','director')
  );

create policy "audit_log_insert" on public.audit_log
  for insert with check (facility_id = public.my_facility_id());

-- notification_preferences: own only
create policy "notif_prefs_own" on public.notification_preferences
  for all using (profile_id = auth.uid());

-- ================================================================
-- 5. SEED DATA — Sunrise Gardens + 4 Residents
-- ================================================================

-- Facility
insert into public.facilities (id, name, slug, address, phone)
values (
  'a1b2c3d4-0001-0001-0001-000000000001',
  'Sunrise Gardens',
  'sunrise-gardens',
  '4500 Sunrise Blvd, Clearwater, FL 34615',
  '(727) 555-0100'
) on conflict (slug) do nothing;

-- Residents (no auth accounts needed for seed — these are care recipients not users)
insert into public.residents (id, facility_id, full_name, room_number, date_of_birth, admission_date, pcc_resident_id, tabula_resident_id, is_active)
values
  (
    'b1b2c3d4-0001-0001-0001-000000000001',
    'a1b2c3d4-0001-0001-0001-000000000001',
    'Eleanor Whitmore',
    '104A',
    '1938-06-14',
    '2024-03-01',
    'pcc-441',
    'tab-881',
    true
  ),
  (
    'b1b2c3d4-0001-0001-0001-000000000002',
    'a1b2c3d4-0001-0001-0001-000000000001',
    'Harold Jennings',
    '207B',
    '1935-11-22',
    '2023-09-15',
    'pcc-442',
    'tab-882',
    true
  ),
  (
    'b1b2c3d4-0001-0001-0001-000000000003',
    'a1b2c3d4-0001-0001-0001-000000000001',
    'Margaret Osei',
    '312',
    '1942-02-08',
    '2024-01-10',
    'pcc-443',
    'tab-883',
    true
  ),
  (
    'b1b2c3d4-0001-0001-0001-000000000004',
    'a1b2c3d4-0001-0001-0001-000000000001',
    'Robert Kim',
    '118',
    '1940-07-30',
    '2024-06-20',
    'pcc-444',
    'tab-884',
    true
  )
on conflict (id) do nothing;

-- Sample care events for the demo (Eleanor Whitmore)
insert into public.care_events (facility_id, resident_id, source, source_record_id, event_type, title, detail, occurred_at, severity)
values
  (
    'a1b2c3d4-0001-0001-0001-000000000001',
    'b1b2c3d4-0001-0001-0001-000000000001',
    'pointclickcare', 'pcc-meal-8291',
    'meal', 'Dinner — full portion eaten',
    'Roast chicken. ~90% consumed. Good appetite.',
    now() - interval '5 hours', 'info'
  ),
  (
    'a1b2c3d4-0001-0001-0001-000000000001',
    'b1b2c3d4-0001-0001-0001-000000000001',
    'pointclickcare', 'pcc-med-5510',
    'medication', 'Evening medications administered',
    'Lisinopril 10mg, Metformin 500mg. No adverse reactions.',
    now() - interval '6 hours', 'info'
  ),
  (
    'a1b2c3d4-0001-0001-0001-000000000001',
    'b1b2c3d4-0001-0001-0001-000000000001',
    'pointclickcare', 'pcc-act-3301',
    'activity', 'Afternoon bingo — participated',
    'Engaged for full 45-minute session. Won twice. High spirits.',
    now() - interval '9 hours', 'info'
  ),
  (
    'a1b2c3d4-0001-0001-0001-000000000001',
    'b1b2c3d4-0001-0001-0001-000000000001',
    'pointclickcare', 'pcc-meal-8290',
    'meal', 'Lunch — partial portion',
    'Soup and sandwich. ~60% consumed. Mentioned mild nausea.',
    now() - interval '10 hours', 'warning'
  ),
  (
    'a1b2c3d4-0001-0001-0001-000000000001',
    'b1b2c3d4-0001-0001-0001-000000000001',
    'pointclickcare', 'pcc-med-5509',
    'medication', 'Morning medications administered',
    'All scheduled medications given on time.',
    now() - interval '13 hours', 'info'
  )
on conflict (source, source_record_id) do nothing;
