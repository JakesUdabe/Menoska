-- ABI News core schema: orgs, RBAC, bulletins, RLS
create extension if not exists pgcrypto;

create schema if not exists private;

do $$ begin
  create type public.app_role as enum ('superadmin', 'admin', 'client');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.plan_type as enum ('starter', 'business', 'enterprise');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.bulletin_frequency as enum ('daily', 'weekly', 'biweekly', 'monthly');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.bulletin_status as enum ('draft', 'active', 'paused', 'archived');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.item_source as enum ('news', 'patent');
exception when duplicate_object then null;
end $$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  domain text unique,
  plan public.plan_type not null default 'starter',
  stripe_customer_id text unique,
  stripe_subscription_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  locale text not null default 'es',
  role public.app_role not null default 'client',
  organization_id uuid references public.organizations (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.free_email_domains (
  domain text primary key
);

insert into public.free_email_domains (domain) values
  ('gmail.com'), ('googlemail.com'), ('outlook.com'), ('outlook.es'),
  ('hotmail.com'), ('hotmail.es'), ('live.com'), ('msn.com'),
  ('yahoo.com'), ('yahoo.es'), ('icloud.com'), ('me.com'), ('mac.com'),
  ('aol.com'), ('proton.me'), ('protonmail.com'), ('gmx.com'), ('gmx.es'),
  ('mail.com'), ('yandex.com'), ('zoho.com')
on conflict do nothing;

create table if not exists public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  role public.app_role not null default 'client',
  invited_by uuid references public.profiles (id) on delete set null,
  token text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.bulletins (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete restrict,
  name text not null,
  language text not null default 'es',
  frequency public.bulletin_frequency not null default 'weekly',
  send_day smallint,
  send_hour smallint not null default 7,
  timezone text not null default 'UTC',
  nl_query text,
  status public.bulletin_status not null default 'draft',
  max_items integer not null default 8,
  header_img_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bulletin_sections (
  id uuid primary key default gen_random_uuid(),
  bulletin_id uuid not null references public.bulletins (id) on delete cascade,
  title text not null,
  companies text[] not null default '{}',
  competitors text[] not null default '{}',
  technologies text[] not null default '{}',
  sort_order integer not null default 0
);

create table if not exists public.bulletin_recipients (
  id uuid primary key default gen_random_uuid(),
  bulletin_id uuid not null references public.bulletins (id) on delete cascade,
  email text not null,
  verified boolean not null default false,
  unique (bulletin_id, email)
);

create table if not exists public.bulletin_deliveries (
  id uuid primary key default gen_random_uuid(),
  bulletin_id uuid not null references public.bulletins (id) on delete cascade,
  sent_at timestamptz not null default now(),
  html text,
  item_count integer not null default 0
);

create table if not exists public.bulletin_items (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.bulletin_deliveries (id) on delete cascade,
  source public.item_source not null,
  source_url text not null,
  title text not null,
  unique (delivery_id, source_url)
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  company text,
  message text not null,
  locale text not null default 'es',
  created_at timestamptz not null default now()
);

create table if not exists public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  kind text not null,
  tokens integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_invites enable row level security;
alter table public.bulletins enable row level security;
alter table public.bulletin_sections enable row level security;
alter table public.bulletin_recipients enable row level security;
alter table public.bulletin_deliveries enable row level security;
alter table public.bulletin_items enable row level security;
alter table public.leads enable row level security;
alter table public.deletion_requests enable row level security;
alter table public.ai_usage_events enable row level security;
alter table public.free_email_domains enable row level security;

create or replace function private.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role')::public.app_role,
    'client'::public.app_role
  );
$$;

create or replace function private.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'organization_id', '')::uuid;
$$;

create or replace function private.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.current_role() = 'superadmin';
$$;

-- Keep authorization claims in app_metadata (never user_metadata).
create or replace function private.sync_profile_app_metadata()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object(
      'role', new.role,
      'organization_id', new.organization_id
    )
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists trg_sync_profile_app_metadata on public.profiles;
create trigger trg_sync_profile_app_metadata
after insert or update of role, organization_id
on public.profiles
for each row execute function private.sync_profile_app_metadata();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  email_domain text;
  org_id uuid;
  org_name text;
  assigned_role public.app_role := 'client';
  super_email text := current_setting('app.settings.superadmin_email', true);
begin
  email_domain := lower(split_part(new.email, '@', 2));
  org_name := coalesce(new.raw_user_meta_data ->> 'organization_name', split_part(new.email, '@', 1));

  if super_email is not null and lower(new.email) = lower(super_email) then
    assigned_role := 'superadmin';
  end if;

  if email_domain is not null and not exists (select 1 from public.free_email_domains d where d.domain = email_domain) then
    select id into org_id from public.organizations where domain = email_domain;
    if org_id is null then
      insert into public.organizations (name, slug, domain)
      values (
        coalesce(nullif(org_name, ''), email_domain),
        left(regexp_replace(lower(email_domain), '[^a-z0-9]+', '-', 'g'), 48),
        email_domain
      )
      returning id into org_id;
      if assigned_role = 'client' then
        assigned_role := 'admin';
      end if;
    end if;
  end if;

  insert into public.profiles (id, full_name, locale, role, organization_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'locale', 'es'),
    assigned_role,
    org_id
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- RLS policies
create policy profiles_select on public.profiles
for select to authenticated
using (
  private.is_superadmin()
  or id = auth.uid()
  or (organization_id is not null and organization_id = private.current_org_id() and private.current_role() = 'admin')
);

create policy profiles_update_self on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy orgs_select on public.organizations
for select to authenticated
using (private.is_superadmin() or id = private.current_org_id());

create policy orgs_update_admin on public.organizations
for update to authenticated
using (private.is_superadmin() or (id = private.current_org_id() and private.current_role() = 'admin'))
with check (private.is_superadmin() or (id = private.current_org_id() and private.current_role() = 'admin'));

create policy bulletins_select on public.bulletins
for select to authenticated
using (
  private.is_superadmin()
  or (organization_id = private.current_org_id() and private.current_role() = 'admin')
  or created_by = auth.uid()
);

create policy bulletins_write_own on public.bulletins
for all to authenticated
using (
  private.is_superadmin()
  or created_by = auth.uid()
  or (organization_id = private.current_org_id() and private.current_role() = 'admin')
)
with check (
  private.is_superadmin()
  or created_by = auth.uid()
  or (organization_id = private.current_org_id() and private.current_role() = 'admin')
);

create policy sections_via_bulletin on public.bulletin_sections
for all to authenticated
using (exists (select 1 from public.bulletins b where b.id = bulletin_id and (
  private.is_superadmin() or b.created_by = auth.uid() or (b.organization_id = private.current_org_id() and private.current_role() = 'admin')
)))
with check (exists (select 1 from public.bulletins b where b.id = bulletin_id and (
  private.is_superadmin() or b.created_by = auth.uid() or (b.organization_id = private.current_org_id() and private.current_role() = 'admin')
)));

create policy recipients_via_bulletin on public.bulletin_recipients
for all to authenticated
using (exists (select 1 from public.bulletins b where b.id = bulletin_id and (
  private.is_superadmin() or b.created_by = auth.uid() or (b.organization_id = private.current_org_id() and private.current_role() = 'admin')
)))
with check (exists (select 1 from public.bulletins b where b.id = bulletin_id and (
  private.is_superadmin() or b.created_by = auth.uid() or (b.organization_id = private.current_org_id() and private.current_role() = 'admin')
)));

create policy deliveries_select on public.bulletin_deliveries
for select to authenticated
using (exists (select 1 from public.bulletins b where b.id = bulletin_id and (
  private.is_superadmin() or b.created_by = auth.uid() or (b.organization_id = private.current_org_id() and private.current_role() = 'admin')
)));

create policy items_select on public.bulletin_items
for select to authenticated
using (exists (
  select 1 from public.bulletin_deliveries d
  join public.bulletins b on b.id = d.bulletin_id
  where d.id = delivery_id and (
    private.is_superadmin() or b.created_by = auth.uid() or (b.organization_id = private.current_org_id() and private.current_role() = 'admin')
  )
));

create policy invites_admin on public.organization_invites
for all to authenticated
using (private.is_superadmin() or (organization_id = private.current_org_id() and private.current_role() = 'admin'))
with check (private.is_superadmin() or (organization_id = private.current_org_id() and private.current_role() = 'admin'));

create policy deletion_self on public.deletion_requests
for all to authenticated
using (user_id = auth.uid() or private.is_superadmin())
with check (user_id = auth.uid() or private.is_superadmin());

create policy usage_org on public.ai_usage_events
for select to authenticated
using (private.is_superadmin() or organization_id = private.current_org_id());

create policy leads_insert_anon on public.leads
for insert to anon, authenticated
with check (true);

create policy leads_select_staff on public.leads
for select to authenticated
using (private.is_superadmin());

create policy free_domains_read on public.free_email_domains
for select to anon, authenticated
using (true);

revoke all on function private.current_role() from public;
revoke all on function private.current_org_id() from public;
revoke all on function private.is_superadmin() from public;
revoke all on function private.sync_profile_app_metadata() from public;
grant execute on function public.handle_new_user() to supabase_auth_admin;
