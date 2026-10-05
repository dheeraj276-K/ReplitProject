-- SmartQueue schema and secure queue operations for Supabase.
-- Apply this file to a new Supabase project from the SQL Editor.

create extension if not exists pgcrypto;

do $$ begin
  create type public.smartqueue_role as enum ('user', 'admin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.smartqueue_token_status as enum (
    'WAITING', 'CALLED', 'SERVING', 'COMPLETED', 'CANCELLED', 'SKIPPED', 'EXPIRED'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  phone text not null default '',
  date_of_birth date,
  gender text,
  address text,
  role public.smartqueue_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  department text not null default '',
  prefix text not null,
  average_service_time_minutes integer not null default 5
    check (average_service_time_minutes between 1 and 240),
  max_daily_tokens integer not null default 100
    check (max_daily_tokens between 1 and 100000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint services_prefix_format check (prefix ~ '^[A-Z]{1,4}$')
);

create table if not exists public.tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  service_date date not null default (now() at time zone 'UTC')::date,
  token_number text not null,
  sequence_number integer not null check (sequence_number > 0),
  status public.smartqueue_token_status not null default 'WAITING',
  created_at timestamptz not null default now(),
  called_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint tokens_daily_sequence_unique unique (service_id, service_date, sequence_number),
  constraint tokens_daily_number_unique unique (service_id, service_date, token_number)
);

-- Atomic upsert of the counter replaces the unsafe MAX(sequence) + 1 pattern.
create table if not exists public.token_counters (
  service_id uuid not null references public.services(id) on delete cascade,
  service_date date not null,
  current_sequence integer not null default 0 check (current_sequence >= 0),
  primary key (service_id, service_date)
);

create index if not exists tokens_user_recent_idx
  on public.tokens (user_id, created_at desc);
create index if not exists tokens_service_queue_idx
  on public.tokens (service_id, service_date, status, sequence_number);
create unique index if not exists tokens_one_active_per_user_service_idx
  on public.tokens (user_id, service_id)
  where status in ('WAITING', 'CALLED', 'SERVING');
create unique index if not exists tokens_one_serving_per_service_day_idx
  on public.tokens (service_id, service_date)
  where status = 'SERVING';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists services_set_updated_at on public.services;
create trigger services_set_updated_at
before update on public.services
for each row execute function public.set_updated_at();

drop trigger if exists tokens_set_updated_at on public.tokens;
create trigger tokens_set_updated_at
before update on public.tokens
for each row execute function public.set_updated_at();

create or replace function public.is_smartqueue_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.role is distinct from old.role
     and session_user not in ('postgres', 'supabase_admin', 'service_role', 'supabase_auth_admin')
     and not coalesce(public.is_smartqueue_admin(), false) then
    raise exception using errcode = '42501', message = 'Only an administrator may change a role.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
before update on public.profiles
for each row execute function public.protect_profile_role();

create or replace function public.create_smartqueue_profile()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        email = excluded.email,
        phone = excluded.phone;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_smartqueue on auth.users;
create trigger on_auth_user_created_smartqueue
after insert on auth.users
for each row execute function public.create_smartqueue_profile();

create or replace function public.sync_smartqueue_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = coalesce(new.email, '') where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated_smartqueue on auth.users;
create trigger on_auth_user_email_updated_smartqueue
after update of email on auth.users
for each row execute function public.sync_smartqueue_profile_email();

alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.tokens enable row level security;
alter table public.token_counters enable row level security;

drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_smartqueue_admin());

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin on public.profiles
for update to authenticated
using (id = auth.uid() or public.is_smartqueue_admin())
with check (id = auth.uid() or public.is_smartqueue_admin());

drop policy if exists services_read_active_or_admin on public.services;
create policy services_read_active_or_admin on public.services
for select to anon, authenticated
using (is_active or (auth.uid() is not null and public.is_smartqueue_admin()));

drop policy if exists services_read_authenticated on public.services;
create policy services_read_authenticated on public.services
for select to authenticated
using (true);

drop policy if exists services_manage_admin on public.services;
create policy services_manage_admin on public.services
for all to authenticated
using (public.is_smartqueue_admin())
with check (public.is_smartqueue_admin());

drop policy if exists tokens_read_self_or_admin on public.tokens;
create policy tokens_read_self_or_admin on public.tokens
for select to authenticated
using (user_id = auth.uid() or public.is_smartqueue_admin());

-- No client-side insert/update/delete policies are created for tokens or counters.
-- Mutations go through authenticated SECURITY DEFINER functions below.

grant usage on schema public to anon, authenticated;
grant select on public.services to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.tokens to authenticated;
revoke all on public.token_counters from anon, authenticated;
revoke insert, update, delete on public.tokens from anon, authenticated;
grant insert, update, delete on public.services to authenticated;

create or replace function public.public_service_overview()
returns table (
  id uuid,
  name text,
  description text,
  department text,
  prefix text,
  average_service_time_minutes integer,
  max_daily_tokens integer,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  queue_size bigint,
  current_serving_token text
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    s.id, s.name, s.description, s.department, s.prefix,
    s.average_service_time_minutes, s.max_daily_tokens, s.is_active,
    s.created_at, s.updated_at,
    (select count(*) from public.tokens t
      where t.service_id = s.id
        and t.service_date = (now() at time zone 'UTC')::date
        and t.status in ('WAITING', 'CALLED')) as queue_size,
    (select t.token_number from public.tokens t
      where t.service_id = s.id
        and t.service_date = (now() at time zone 'UTC')::date
        and t.status in ('SERVING', 'CALLED')
      order by case t.status when 'SERVING' then 0 else 1 end, t.sequence_number
      limit 1) as current_serving_token
  from public.services s
  where s.is_active or (auth.uid() is not null and public.is_smartqueue_admin())
  order by s.name;
$$;

create or replace function public.user_token_details(p_token_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'id', t.id,
    'token_number', t.token_number,
    'service_id', t.service_id,
    'service_name', s.name,
    'status', t.status,
    'created_at', t.created_at,
    'queue_position', case when t.status = 'WAITING' then ahead.count_ahead + 1 else 0 end,
    'people_ahead', ahead.count_ahead,
    'estimated_wait_minutes',
      case when t.status = 'WAITING'
        then ahead.count_ahead * s.average_service_time_minutes
        else 0
      end,
    'current_serving_token', serving.token_number
  )
  into v_result
  from public.tokens t
  join public.services s on s.id = t.service_id
  cross join lateral (
    select count(*)::integer as count_ahead
    from public.tokens earlier
    where earlier.service_id = t.service_id
      and earlier.service_date = t.service_date
      and earlier.status in ('WAITING', 'CALLED')
      and (earlier.sequence_number, earlier.id) < (t.sequence_number, t.id)
  ) ahead
  left join lateral (
    select current_token.token_number
    from public.tokens current_token
    where current_token.service_id = t.service_id
      and current_token.service_date = t.service_date
      and current_token.status in ('SERVING', 'CALLED')
    order by case current_token.status when 'SERVING' then 0 else 1 end,
      current_token.sequence_number
    limit 1
  ) serving on true
  where t.id = p_token_id
    and (t.user_id = auth.uid() or public.is_smartqueue_admin());

  return v_result;
end;
$$;

create or replace function public.generate_token(p_service_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_service public.services%rowtype;
  v_sequence integer;
  v_token_id uuid;
  v_day date := (now() at time zone 'UTC')::date;
  v_token_number text;
  v_existing_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Sign in to generate a token.';
  end if;

  select * into v_service
  from public.services
  where id = p_service_id and is_active
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'Service is currently unavailable.';
  end if;

  select id into v_existing_id
  from public.tokens
  where user_id = v_user_id and service_id = p_service_id
    and status in ('WAITING', 'CALLED', 'SERVING')
  limit 1;
  if v_existing_id is not null then
    raise exception using errcode = 'P0001', message = 'You already have an active token for this service.';
  end if;

  if (select count(*) from public.tokens
      where service_id = p_service_id and service_date = v_day)
      >= v_service.max_daily_tokens then
    raise exception using errcode = 'P0001', message = 'This service has reached its daily token limit.';
  end if;

  insert into public.token_counters (service_id, service_date, current_sequence)
  values (p_service_id, v_day, 1)
  on conflict (service_id, service_date)
  do update set current_sequence = public.token_counters.current_sequence + 1
  returning current_sequence into v_sequence;

  v_token_number := v_service.prefix || lpad(v_sequence::text, greatest(3, length(v_sequence::text)), '0');

  insert into public.tokens (
    user_id, service_id, service_date, token_number, sequence_number, status
  )
  values (
    v_user_id, p_service_id, v_day, v_token_number, v_sequence, 'WAITING'
  )
  returning id into v_token_id;

  return public.user_token_details(v_token_id);
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'You already have an active token for this service.';
end;
$$;

create or replace function public.cancel_token(p_token_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_updated integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Sign in to cancel a token.';
  end if;

  update public.tokens
  set status = 'CANCELLED', cancelled_at = now()
  where id = p_token_id
    and user_id = auth.uid()
    and status in ('WAITING', 'CALLED');

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception using errcode = 'P0001', message = 'This token can no longer be cancelled.';
  end if;
  return true;
end;
$$;

create or replace function public.admin_call_next(p_service_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_day date := (now() at time zone 'UTC')::date;
  v_token_id uuid;
begin
  if not public.is_smartqueue_admin() then
    raise exception using errcode = '42501', message = 'Administrator access is required.';
  end if;

  perform 1 from public.services where id = p_service_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'Service does not exist.';
  end if;

  update public.tokens
  set status = 'COMPLETED', completed_at = now()
  where service_id = p_service_id and service_date = v_day and status = 'SERVING';

  update public.tokens
  set status = 'SKIPPED'
  where service_id = p_service_id and service_date = v_day and status = 'CALLED';

  select id into v_token_id
  from public.tokens
  where service_id = p_service_id and service_date = v_day and status = 'WAITING'
  order by sequence_number
  for update skip locked
  limit 1;

  if v_token_id is null then
    return null;
  end if;

  update public.tokens
  set status = 'CALLED', called_at = now()
  where id = v_token_id;

  return public.user_token_details(v_token_id);
end;
$$;

create or replace function public.admin_set_token_status(p_token_id uuid, p_status text)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_status public.smartqueue_token_status;
  v_updated integer;
begin
  if not public.is_smartqueue_admin() then
    raise exception using errcode = '42501', message = 'Administrator access is required.';
  end if;

  if p_status is null
     or p_status not in ('CALLED', 'SERVING', 'COMPLETED', 'CANCELLED', 'SKIPPED', 'EXPIRED') then
    raise exception using errcode = '22023', message = 'Invalid administrator token action.';
  end if;
  v_status := p_status::public.smartqueue_token_status;

  update public.tokens
  set status = v_status,
      called_at = case when v_status in ('CALLED', 'SERVING') then coalesce(called_at, now()) else called_at end,
      completed_at = case when v_status = 'COMPLETED' then now() else completed_at end,
      cancelled_at = case when v_status = 'CANCELLED' then now() else cancelled_at end
  where id = p_token_id
    and (
      (v_status = 'CALLED' and status = 'WAITING')
      or
      (v_status = 'SERVING' and status in ('WAITING', 'CALLED'))
      or (v_status = 'COMPLETED' and status in ('CALLED', 'SERVING'))
      or (v_status in ('CANCELLED', 'SKIPPED', 'EXPIRED') and status in ('WAITING', 'CALLED'))
    );

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception using errcode = 'P0001', message = 'This token cannot move to the requested status.';
  end if;
  return true;
end;
$$;

create or replace function public.admin_dashboard_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_day date := (now() at time zone 'UTC')::date;
  v_result jsonb;
begin
  if not public.is_smartqueue_admin() then
    raise exception using errcode = '42501', message = 'Administrator access is required.';
  end if;

  select jsonb_build_object(
    'today_tokens', count(*),
    'active_tokens', count(*) filter (where status in ('WAITING', 'CALLED', 'SERVING')),
    'completed_tokens', count(*) filter (where status = 'COMPLETED'),
    'cancelled_tokens', count(*) filter (where status = 'CANCELLED'),
    'average_wait_minutes',
      coalesce(round(avg(extract(epoch from (coalesce(called_at, completed_at) - created_at)) / 60)
        filter (where status = 'COMPLETED' and coalesce(called_at, completed_at) is not null), 1), 0)
  )
  into v_result
  from public.tokens
  where service_date = v_day;

  return v_result;
end;
$$;

-- Clients can call only the narrowly scoped, identity-checking functions.
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.protect_profile_role() from public, anon, authenticated;
revoke all on function public.create_smartqueue_profile() from public, anon, authenticated;
revoke all on function public.sync_smartqueue_profile_email() from public, anon, authenticated;
revoke all on function public.is_smartqueue_admin() from public, anon;
revoke all on function public.public_service_overview() from public;
revoke all on function public.user_token_details(uuid) from public, anon;
revoke all on function public.generate_token(uuid) from public, anon;
revoke all on function public.cancel_token(uuid) from public, anon;
revoke all on function public.admin_call_next(uuid) from public, anon;
revoke all on function public.admin_set_token_status(uuid, text) from public, anon;
revoke all on function public.admin_dashboard_summary() from public, anon;
grant execute on function public.is_smartqueue_admin() to authenticated;
grant execute on function public.public_service_overview() to anon, authenticated;
grant execute on function public.user_token_details(uuid) to authenticated;
grant execute on function public.generate_token(uuid) to authenticated;
grant execute on function public.cancel_token(uuid) to authenticated;
grant execute on function public.admin_call_next(uuid) to authenticated;
grant execute on function public.admin_set_token_status(uuid, text) to authenticated;
grant execute on function public.admin_dashboard_summary() to authenticated;

-- Public-facing sample services; no personal sample accounts are created.
insert into public.services (name, description, department, prefix, average_service_time_minutes, max_daily_tokens)
values
  ('General Consultation', 'Meet with a clinician for a general health concern.', 'Outpatient Care', 'G', 8, 120),
  ('Billing', 'Get help with invoices, payments, and account questions.', 'Finance', 'B', 4, 100),
  ('Customer Support', 'Speak with a support specialist about your request.', 'Support', 'C', 6, 100),
  ('Document Verification', 'Submit documents for review and verification.', 'Records', 'D', 5, 80)
on conflict (name) do nothing;

-- Enable status-change events for authenticated realtime subscribers.
do $$
declare
  v_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach v_table in array array['profiles', 'services', 'tokens'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = v_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', v_table);
      end if;
    end loop;
  end if;
end;
$$;
