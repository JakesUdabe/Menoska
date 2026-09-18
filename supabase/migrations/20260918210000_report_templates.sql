-- Report templates and generated intelligence reports (ABI News tools 2-4)

do $$ begin
  create type public.report_kind as enum ('estado_arte', 'informe_mercado', 'social_listening');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.report_status as enum ('draft', 'generating', 'ready', 'failed');
exception when duplicate_object then null;
end $$;

create table if not exists public.report_templates (
  id uuid primary key default gen_random_uuid(),
  kind public.report_kind not null unique,
  name text not null,
  description text not null default '',
  cuestionario_schema jsonb not null default '[]'::jsonb,
  plantilla_schema jsonb not null default '{"secciones":[]}'::jsonb,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.intelligence_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete restrict,
  kind public.report_kind not null,
  template_id uuid references public.report_templates (id) on delete set null,
  title text not null,
  answers jsonb not null default '{}'::jsonb,
  markdown text not null default '',
  sources jsonb not null default '[]'::jsonb,
  status public.report_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists intelligence_reports_org_kind_idx
  on public.intelligence_reports (organization_id, kind, created_at desc);

alter table public.report_templates enable row level security;
alter table public.intelligence_reports enable row level security;

drop policy if exists report_templates_read on public.report_templates;
create policy report_templates_read on public.report_templates
  for select to authenticated
  using (true);

drop policy if exists report_templates_write_superadmin on public.report_templates;
create policy report_templates_write_superadmin on public.report_templates
  for all to authenticated
  using (private.is_superadmin())
  with check (private.is_superadmin());

drop policy if exists intelligence_reports_select on public.intelligence_reports;
create policy intelligence_reports_select on public.intelligence_reports
  for select to authenticated
  using (
    private.is_superadmin()
    or organization_id = private.current_org_id()
  );

drop policy if exists intelligence_reports_insert on public.intelligence_reports;
create policy intelligence_reports_insert on public.intelligence_reports
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and organization_id = private.current_org_id()
  );

drop policy if exists intelligence_reports_update on public.intelligence_reports;
create policy intelligence_reports_update on public.intelligence_reports
  for update to authenticated
  using (
    private.is_superadmin()
    or created_by = auth.uid()
    or (private.current_role() = 'admin' and organization_id = private.current_org_id())
  );

drop policy if exists intelligence_reports_delete on public.intelligence_reports;
create policy intelligence_reports_delete on public.intelligence_reports
  for delete to authenticated
  using (
    private.is_superadmin()
    or created_by = auth.uid()
    or (private.current_role() = 'admin' and organization_id = private.current_org_id())
  );
