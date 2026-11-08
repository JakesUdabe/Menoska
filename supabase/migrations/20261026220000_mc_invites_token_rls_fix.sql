-- Fix: mc_invites_token_select allowed anon to SELECT every pending invite
-- (accepted_at is null and expires_at > now()) with no token filter.
-- Replace with a SECURITY DEFINER lookup that returns one invite by token only.
-- Org/admin full-table access stays on existing admin RLS policies.

drop policy if exists mc_invites_token_select on public.mc_organization_invites;

create or replace function public.mc_lookup_invite(p_token text)
returns table (
  id uuid,
  organization_id uuid,
  organization_name text,
  email text,
  role public.mc_app_role,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.id,
    i.organization_id,
    o.name as organization_name,
    i.email,
    i.role,
    i.expires_at
  from public.mc_organization_invites i
  join public.mc_organizations o on o.id = i.organization_id
  where nullif(btrim(p_token), '') is not null
    and i.token = btrim(p_token)
    and i.accepted_at is null
    and i.expires_at > now()
  limit 1;
$$;

revoke all on function public.mc_lookup_invite(text) from public;
grant execute on function public.mc_lookup_invite(text) to anon, authenticated;

comment on function public.mc_lookup_invite(text) is
  'Public invite preview by token only. Does not expose other pending invites.';
