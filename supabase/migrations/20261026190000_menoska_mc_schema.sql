-- Menoska Consulting schema (mc_*). Safe to apply on a Supabase project shared with Proposalyze.
-- Does NOT create/replace public.profiles, public.organizations, or public.handle_new_user.

create extension if not exists pgcrypto;

create schema if not exists private;

do $$ begin
  create type public.mc_app_role as enum ('superadmin', 'admin', 'client');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.mc_plan_type as enum ('starter', 'business', 'enterprise');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.mc_bulletin_frequency as enum ('daily', 'weekly', 'biweekly', 'monthly');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.mc_bulletin_status as enum ('draft', 'active', 'paused', 'archived');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.mc_report_kind as enum ('estado_arte', 'informe_mercado', 'social_listening');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.mc_report_status as enum ('draft', 'generating', 'ready', 'failed');
exception when duplicate_object then null;
end $$;

-- Organizations
create table if not exists public.mc_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  domain text unique,
  plan public.mc_plan_type not null default 'starter',
  stripe_customer_id text unique,
  stripe_subscription_id text,
  created_at timestamptz not null default now()
);

-- Profiles (1:1 with auth.users)
create table if not exists public.mc_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text,
  last_name text,
  full_name text,
  locale text not null default 'es',
  role public.mc_app_role not null default 'client',
  organization_id uuid references public.mc_organizations (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Bulletins
create table if not exists public.mc_bulletins (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.mc_organizations (id) on delete cascade,
  created_by uuid not null references public.mc_profiles (id) on delete restrict,
  name text not null,
  subject text not null default '',
  language text not null default 'es',
  frequency public.mc_bulletin_frequency not null default 'weekly',
  send_day smallint,
  send_hour smallint not null default 7,
  timezone text not null default 'UTC',
  nl_query text,
  mode text not null default 'common',
  status public.mc_bulletin_status not null default 'draft',
  max_items integer not null default 8,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mc_bulletin_sections (
  id uuid primary key default gen_random_uuid(),
  bulletin_id uuid not null references public.mc_bulletins (id) on delete cascade,
  title text not null,
  companies text[] not null default '{}',
  competitors text[] not null default '{}',
  technologies text[] not null default '{}',
  sort_order integer not null default 0
);

create table if not exists public.mc_bulletin_recipients (
  id uuid primary key default gen_random_uuid(),
  bulletin_id uuid not null references public.mc_bulletins (id) on delete cascade,
  email text not null,
  companies text[] not null default '{}',
  technologies text[] not null default '{}',
  verified boolean not null default false,
  unique (bulletin_id, email)
);

create table if not exists public.mc_bulletin_deliveries (
  id uuid primary key default gen_random_uuid(),
  bulletin_id uuid not null references public.mc_bulletins (id) on delete cascade,
  sent_at timestamptz not null default now(),
  html text,
  item_count integer not null default 0,
  recipients text[] not null default '{}',
  demo boolean not null default false
);

create table if not exists public.mc_intelligence_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.mc_organizations (id) on delete cascade,
  created_by uuid not null references public.mc_profiles (id) on delete restrict,
  kind public.mc_report_kind not null,
  title text not null,
  answers jsonb not null default '{}'::jsonb,
  markdown text not null default '',
  sources jsonb not null default '[]'::jsonb,
  status public.mc_report_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mc_report_templates (
  id uuid primary key default gen_random_uuid(),
  kind public.mc_report_kind not null unique,
  name text not null,
  description text not null default '',
  cuestionario_schema jsonb not null default '[]'::jsonb,
  plantilla_schema jsonb not null default '{"secciones":[]}'::jsonb,
  updated_by uuid references public.mc_profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.mc_worksheets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.mc_organizations (id) on delete cascade,
  user_id uuid not null references public.mc_profiles (id) on delete cascade,
  tool_id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, tool_id)
);

create table if not exists public.mc_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.mc_profiles (id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.mc_ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.mc_organizations (id) on delete set null,
  user_id uuid references public.mc_profiles (id) on delete set null,
  kind text not null,
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mc_profiles_org_idx on public.mc_profiles (organization_id);
create index if not exists mc_bulletins_org_idx on public.mc_bulletins (organization_id, status);
create index if not exists mc_intelligence_reports_org_kind_idx
  on public.mc_intelligence_reports (organization_id, kind, created_at desc);
create index if not exists mc_ai_usage_org_idx on public.mc_ai_usage_events (organization_id, created_at desc);

-- Helpers (Menoska-scoped; do not clash with Proposalyze private helpers if names differ)
create or replace function private.mc_current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.mc_profiles where id = auth.uid();
$$;

create or replace function private.mc_current_role()
returns public.mc_app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.mc_profiles where id = auth.uid();
$$;

create or replace function private.mc_is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'superadmin' from public.mc_profiles where id = auth.uid()), false);
$$;

-- Signup trigger: Menoska only (does not replace public.handle_new_user)
create or replace function public.menoska_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  org_name text;
  org_domain text;
  email_domain text;
  product text;
begin
  -- Opt-in only (shared DB with Proposalyze): product=menoska or organization_name set
  product := lower(coalesce(new.raw_user_meta_data->>'product', ''));
  if product <> 'menoska' and coalesce(new.raw_user_meta_data->>'organization_name', '') = '' then
    return new;
  end if;

  email_domain := lower(split_part(new.email, '@', 2));
  org_name := coalesce(nullif(new.raw_user_meta_data->>'organization_name', ''), email_domain);
  org_domain := email_domain;

  select id into org_id
  from public.mc_organizations
  where domain = org_domain
  limit 1;

  if org_id is null then
    insert into public.mc_organizations (name, slug, domain, plan)
    values (
      org_name,
      lower(regexp_replace(org_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(gen_random_uuid()::text, 1, 8),
      org_domain,
      'starter'
    )
    returning id into org_id;
  end if;

  insert into public.mc_profiles (id, first_name, last_name, full_name, locale, role, organization_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      trim(coalesce(new.raw_user_meta_data->>'first_name', '') || ' ' || coalesce(new.raw_user_meta_data->>'last_name', ''))
    ),
    coalesce(new.raw_user_meta_data->>'locale', 'es'),
    'client',
    org_id
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_menoska on auth.users;
create trigger on_auth_user_created_menoska
  after insert on auth.users
  for each row execute function public.menoska_handle_new_user();

-- RLS
alter table public.mc_organizations enable row level security;
alter table public.mc_profiles enable row level security;
alter table public.mc_bulletins enable row level security;
alter table public.mc_bulletin_sections enable row level security;
alter table public.mc_bulletin_recipients enable row level security;
alter table public.mc_bulletin_deliveries enable row level security;
alter table public.mc_intelligence_reports enable row level security;
alter table public.mc_report_templates enable row level security;
alter table public.mc_worksheets enable row level security;
alter table public.mc_deletion_requests enable row level security;
alter table public.mc_ai_usage_events enable row level security;

drop policy if exists mc_orgs_select on public.mc_organizations;
create policy mc_orgs_select on public.mc_organizations
  for select to authenticated
  using (private.mc_is_superadmin() or id = private.mc_current_org_id());

drop policy if exists mc_orgs_update_admin on public.mc_organizations;
create policy mc_orgs_update_admin on public.mc_organizations
  for update to authenticated
  using (private.mc_is_superadmin() or (private.mc_current_role() = 'admin' and id = private.mc_current_org_id()))
  with check (private.mc_is_superadmin() or (private.mc_current_role() = 'admin' and id = private.mc_current_org_id()));

drop policy if exists mc_profiles_select on public.mc_profiles;
create policy mc_profiles_select on public.mc_profiles
  for select to authenticated
  using (
    private.mc_is_superadmin()
    or id = auth.uid()
    or organization_id = private.mc_current_org_id()
  );

drop policy if exists mc_profiles_update_self on public.mc_profiles;
create policy mc_profiles_update_self on public.mc_profiles
  for update to authenticated
  using (id = auth.uid() or private.mc_is_superadmin())
  with check (id = auth.uid() or private.mc_is_superadmin());

drop policy if exists mc_bulletins_all on public.mc_bulletins;
create policy mc_bulletins_all on public.mc_bulletins
  for all to authenticated
  using (
    private.mc_is_superadmin()
    or organization_id = private.mc_current_org_id()
  )
  with check (
    private.mc_is_superadmin()
    or (organization_id = private.mc_current_org_id() and created_by = auth.uid())
  );

drop policy if exists mc_bulletin_sections_all on public.mc_bulletin_sections;
create policy mc_bulletin_sections_all on public.mc_bulletin_sections
  for all to authenticated
  using (
    exists (
      select 1 from public.mc_bulletins b
      where b.id = bulletin_id
        and (private.mc_is_superadmin() or b.organization_id = private.mc_current_org_id())
    )
  )
  with check (
    exists (
      select 1 from public.mc_bulletins b
      where b.id = bulletin_id
        and (private.mc_is_superadmin() or b.organization_id = private.mc_current_org_id())
    )
  );

drop policy if exists mc_bulletin_recipients_all on public.mc_bulletin_recipients;
create policy mc_bulletin_recipients_all on public.mc_bulletin_recipients
  for all to authenticated
  using (
    exists (
      select 1 from public.mc_bulletins b
      where b.id = bulletin_id
        and (private.mc_is_superadmin() or b.organization_id = private.mc_current_org_id())
    )
  )
  with check (
    exists (
      select 1 from public.mc_bulletins b
      where b.id = bulletin_id
        and (private.mc_is_superadmin() or b.organization_id = private.mc_current_org_id())
    )
  );

drop policy if exists mc_bulletin_deliveries_select on public.mc_bulletin_deliveries;
create policy mc_bulletin_deliveries_select on public.mc_bulletin_deliveries
  for select to authenticated
  using (
    exists (
      select 1 from public.mc_bulletins b
      where b.id = bulletin_id
        and (private.mc_is_superadmin() or b.organization_id = private.mc_current_org_id())
    )
  );

drop policy if exists mc_bulletin_deliveries_insert on public.mc_bulletin_deliveries;
create policy mc_bulletin_deliveries_insert on public.mc_bulletin_deliveries
  for insert to authenticated
  with check (
    exists (
      select 1 from public.mc_bulletins b
      where b.id = bulletin_id
        and (private.mc_is_superadmin() or b.organization_id = private.mc_current_org_id())
    )
  );

drop policy if exists mc_intelligence_reports_all on public.mc_intelligence_reports;
create policy mc_intelligence_reports_all on public.mc_intelligence_reports
  for all to authenticated
  using (private.mc_is_superadmin() or organization_id = private.mc_current_org_id())
  with check (created_by = auth.uid() and organization_id = private.mc_current_org_id());

drop policy if exists mc_report_templates_read on public.mc_report_templates;
create policy mc_report_templates_read on public.mc_report_templates
  for select to authenticated using (true);

drop policy if exists mc_report_templates_write on public.mc_report_templates;
create policy mc_report_templates_write on public.mc_report_templates
  for all to authenticated
  using (private.mc_is_superadmin())
  with check (private.mc_is_superadmin());

drop policy if exists mc_worksheets_all on public.mc_worksheets;
create policy mc_worksheets_all on public.mc_worksheets
  for all to authenticated
  using (user_id = auth.uid() or private.mc_is_superadmin())
  with check (user_id = auth.uid());

drop policy if exists mc_deletion_requests_insert on public.mc_deletion_requests;
create policy mc_deletion_requests_insert on public.mc_deletion_requests
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists mc_deletion_requests_select on public.mc_deletion_requests;
create policy mc_deletion_requests_select on public.mc_deletion_requests
  for select to authenticated
  using (user_id = auth.uid() or private.mc_is_superadmin());

drop policy if exists mc_ai_usage_select on public.mc_ai_usage_events;
create policy mc_ai_usage_select on public.mc_ai_usage_events
  for select to authenticated
  using (private.mc_is_superadmin() or organization_id = private.mc_current_org_id());

drop policy if exists mc_ai_usage_insert on public.mc_ai_usage_events;
create policy mc_ai_usage_insert on public.mc_ai_usage_events
  for insert to authenticated
  with check (user_id = auth.uid());
