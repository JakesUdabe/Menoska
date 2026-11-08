-- Opaque API keys for /api/v1/* (hashed at rest). Prefer mc_* only.

create table if not exists public.mc_api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.mc_organizations (id) on delete cascade,
  name text not null default 'default',
  key_hash text not null,
  prefix text not null default 'mk_',
  created_by uuid references public.mc_profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  active boolean not null default true,
  constraint mc_api_keys_key_hash_unique unique (key_hash)
);

create index if not exists mc_api_keys_org_idx on public.mc_api_keys (organization_id);
create index if not exists mc_api_keys_hash_idx on public.mc_api_keys (key_hash) where active = true;

comment on table public.mc_api_keys is 'SHA-256 hashed opaque keys (mk_…); plaintext never stored';

alter table public.mc_api_keys enable row level security;

drop policy if exists mc_api_keys_select on public.mc_api_keys;
create policy mc_api_keys_select on public.mc_api_keys
  for select to authenticated
  using (
    private.mc_is_superadmin()
    or (
      organization_id = private.mc_current_org_id()
      and private.mc_current_role() in ('admin', 'superadmin')
    )
  );

drop policy if exists mc_api_keys_write on public.mc_api_keys;
create policy mc_api_keys_write on public.mc_api_keys
  for all to authenticated
  using (
    private.mc_is_superadmin()
    or (
      organization_id = private.mc_current_org_id()
      and private.mc_current_role() in ('admin', 'superadmin')
    )
  )
  with check (
    private.mc_is_superadmin()
    or (
      organization_id = private.mc_current_org_id()
      and private.mc_current_role() in ('admin', 'superadmin')
    )
  );
