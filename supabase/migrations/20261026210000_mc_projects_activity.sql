-- Projects + activity events for Menoska Consulting (mc_*).
-- Mirrors schema already applied on the shared Supabase project.
-- Safe on a DB shared with Proposalyze (does not touch public.profiles / organizations).

create table if not exists public.mc_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.mc_organizations (id) on delete cascade,
  created_by uuid not null references public.mc_profiles (id) on delete restrict,
  name text not null,
  description text not null default '',
  status text not null default 'active',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mc_project_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.mc_projects (id) on delete cascade,
  kind text not null,
  ref_id text not null,
  label text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.mc_activity_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.mc_organizations (id) on delete cascade,
  user_id uuid references public.mc_profiles (id) on delete set null,
  kind text not null,
  title text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mc_projects_org_idx on public.mc_projects (organization_id, updated_at desc);
create index if not exists mc_project_links_project_idx on public.mc_project_links (project_id);
create index if not exists mc_activity_org_idx on public.mc_activity_events (organization_id, created_at desc);
create index if not exists mc_activity_user_idx on public.mc_activity_events (user_id, created_at desc);

alter table public.mc_projects enable row level security;
alter table public.mc_project_links enable row level security;
alter table public.mc_activity_events enable row level security;

drop policy if exists mc_projects_all on public.mc_projects;
create policy mc_projects_all on public.mc_projects
  for all to authenticated
  using (private.mc_is_superadmin() or organization_id = private.mc_current_org_id())
  with check (
    private.mc_is_superadmin()
    or (organization_id = private.mc_current_org_id() and created_by = auth.uid())
  );

drop policy if exists mc_project_links_all on public.mc_project_links;
create policy mc_project_links_all on public.mc_project_links
  for all to authenticated
  using (
    exists (
      select 1 from public.mc_projects p
      where p.id = project_id
        and (private.mc_is_superadmin() or p.organization_id = private.mc_current_org_id())
    )
  )
  with check (
    exists (
      select 1 from public.mc_projects p
      where p.id = project_id
        and (private.mc_is_superadmin() or p.organization_id = private.mc_current_org_id())
    )
  );

drop policy if exists mc_activity_select on public.mc_activity_events;
create policy mc_activity_select on public.mc_activity_events
  for select to authenticated
  using (private.mc_is_superadmin() or organization_id = private.mc_current_org_id());

drop policy if exists mc_activity_insert on public.mc_activity_events;
create policy mc_activity_insert on public.mc_activity_events
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (organization_id = private.mc_current_org_id() or private.mc_is_superadmin())
  );
