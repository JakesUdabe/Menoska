-- Org invites for Menoska Consulting (mc_* only — do not touch Proposalyze tables)
create table if not exists public.mc_organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.mc_organizations (id) on delete cascade,
  email text not null,
  role public.mc_app_role not null default 'client',
  invited_by uuid references public.mc_profiles (id) on delete set null,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists mc_organization_invites_org_idx
  on public.mc_organization_invites (organization_id, accepted_at);

create index if not exists mc_organization_invites_token_idx
  on public.mc_organization_invites (token);

alter table public.mc_organization_invites enable row level security;

drop policy if exists mc_invites_select_org on public.mc_organization_invites;
create policy mc_invites_select_org on public.mc_organization_invites
  for select using (
    organization_id = private.mc_current_org_id()
    or private.mc_is_superadmin()
  );

drop policy if exists mc_invites_insert_admin on public.mc_organization_invites;
create policy mc_invites_insert_admin on public.mc_organization_invites
  for insert with check (
    private.mc_is_superadmin()
    or (
      organization_id = private.mc_current_org_id()
      and private.mc_current_role() in ('admin', 'superadmin')
    )
  );

drop policy if exists mc_invites_update_admin on public.mc_organization_invites;
create policy mc_invites_update_admin on public.mc_organization_invites
  for update using (
    private.mc_is_superadmin()
    or (
      organization_id = private.mc_current_org_id()
      and private.mc_current_role() in ('admin', 'superadmin')
    )
  );

-- Public token preview: use public.mc_lookup_invite(token) (see 20261026220000_mc_invites_token_rls_fix.sql).
-- Do not add an anon SELECT policy on pending invites — that leaks all invite rows.
