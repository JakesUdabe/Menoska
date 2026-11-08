-- Hitos 1–4 scaffolding: analytics, NPS, webhooks, benchmarks, delivery status.
-- Prefer mc_* only; does not touch Proposalyze tables.

-- Delivery status for send retries / failures
alter table public.mc_bulletin_deliveries
  add column if not exists status text not null default 'sent';

alter table public.mc_bulletin_deliveries
  add column if not exists error_message text;

comment on column public.mc_bulletin_deliveries.status is 'sent | demo | failed';

-- Analytics funnel events (Hito 1)
create table if not exists public.mc_analytics_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.mc_organizations (id) on delete set null,
  user_id uuid references public.mc_profiles (id) on delete set null,
  event text not null,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mc_analytics_events_event_idx
  on public.mc_analytics_events (event, created_at desc);
create index if not exists mc_analytics_events_org_idx
  on public.mc_analytics_events (organization_id, created_at desc);

alter table public.mc_analytics_events enable row level security;

drop policy if exists mc_analytics_events_insert on public.mc_analytics_events;
create policy mc_analytics_events_insert on public.mc_analytics_events
  for insert to authenticated
  with check (
    private.mc_is_superadmin()
    or user_id = auth.uid()
    or organization_id = private.mc_current_org_id()
  );

drop policy if exists mc_analytics_events_select on public.mc_analytics_events;
create policy mc_analytics_events_select on public.mc_analytics_events
  for select to authenticated
  using (
    private.mc_is_superadmin()
    or organization_id = private.mc_current_org_id()
  );

-- NPS responses (Hito 2)
create table if not exists public.mc_nps_responses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.mc_organizations (id) on delete set null,
  user_id uuid references public.mc_profiles (id) on delete set null,
  score smallint not null check (score >= 0 and score <= 10),
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists mc_nps_responses_org_idx
  on public.mc_nps_responses (organization_id, created_at desc);

alter table public.mc_nps_responses enable row level security;

drop policy if exists mc_nps_responses_insert on public.mc_nps_responses;
create policy mc_nps_responses_insert on public.mc_nps_responses
  for insert to authenticated
  with check (user_id = auth.uid() or private.mc_is_superadmin());

drop policy if exists mc_nps_responses_select on public.mc_nps_responses;
create policy mc_nps_responses_select on public.mc_nps_responses
  for select to authenticated
  using (
    private.mc_is_superadmin()
    or organization_id = private.mc_current_org_id()
  );

-- Outbound webhooks (Hito 3)
create table if not exists public.mc_webhooks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.mc_organizations (id) on delete cascade,
  url text not null,
  secret text not null default '',
  events text[] not null default '{bulletin.sent}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mc_webhooks_org_idx on public.mc_webhooks (organization_id);

alter table public.mc_webhooks enable row level security;

drop policy if exists mc_webhooks_select on public.mc_webhooks;
create policy mc_webhooks_select on public.mc_webhooks
  for select to authenticated
  using (private.mc_is_superadmin() or organization_id = private.mc_current_org_id());

drop policy if exists mc_webhooks_write on public.mc_webhooks;
create policy mc_webhooks_write on public.mc_webhooks
  for all to authenticated
  using (
    private.mc_is_superadmin()
    or (private.mc_current_role() in ('admin', 'superadmin') and organization_id = private.mc_current_org_id())
  )
  with check (
    private.mc_is_superadmin()
    or (private.mc_current_role() in ('admin', 'superadmin') and organization_id = private.mc_current_org_id())
  );

-- Anonymized benchmarks opt-in (Hito 4)
create table if not exists public.mc_benchmarks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.mc_organizations (id) on delete cascade,
  sector text not null default 'general',
  metric text not null,
  value numeric not null,
  period text not null default '2026-Q3',
  opt_in boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists mc_benchmarks_sector_idx
  on public.mc_benchmarks (sector, metric, period);

alter table public.mc_benchmarks enable row level security;

drop policy if exists mc_benchmarks_select on public.mc_benchmarks;
create policy mc_benchmarks_select on public.mc_benchmarks
  for select to authenticated
  using (
    private.mc_is_superadmin()
    or organization_id = private.mc_current_org_id()
    or opt_in = true
  );

drop policy if exists mc_benchmarks_write on public.mc_benchmarks;
create policy mc_benchmarks_write on public.mc_benchmarks
  for all to authenticated
  using (private.mc_is_superadmin() or organization_id = private.mc_current_org_id())
  with check (private.mc_is_superadmin() or organization_id = private.mc_current_org_id());
