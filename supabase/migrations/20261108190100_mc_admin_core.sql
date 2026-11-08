-- Menoska Consulting internal admin (portable kit), namespaced as mc_*.
-- Does not alter Proposalyze public.profiles, time_entries, expenses, or crm_*.
-- Superadmin role is mc_profiles.role = 'superadmin'. Staff with toggles is 'empleado'.
-- Demotion returns role 'client'. Blog and company catalog are not mounted.

-- -----------------------------------------------------------------------------
-- Enums (mc_ prefix so we do not ALTER Proposalyze types)
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.mc_absence_type as enum (
    'vacation', 'sick_leave', 'maternity', 'justified', 'pending'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.mc_absence_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.mc_expense_category as enum (
    'recurrent', 'payroll', 'one_time', 'interest', 'tax', 'depreciation', 'amortization'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.mc_lead_phase as enum (
    'nuevo', 'contactado', 'propuesta', 'negociacion', 'convertido', 'perdido'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.mc_incident_status as enum (
    'abierta', 'en_progreso', 'resuelta', 'cerrada'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.mc_incident_priority as enum ('baja', 'media', 'alta', 'critica');
exception when duplicate_object then null;
end $$;

alter table public.mc_profiles
  add column if not exists employee_permissions jsonb not null default '{}'::jsonb,
  add column if not exists job_title text,
  add column if not exists work_email text,
  add column if not exists calendly_url text;

comment on column public.mc_profiles.employee_permissions is
  'Permisos de empleado. Keys: calendario, finanzas, crm, documentos. empleados no es un permiso.';
comment on column public.mc_profiles.calendly_url is
  'URL https de Cal.com o Calendly. La edita el superadmin en Empleados.';

-- -----------------------------------------------------------------------------
-- RBAC helpers (private). Whitelist is the only persisted permission list.
-- -----------------------------------------------------------------------------
create or replace function private.mc_sanitize_employee_permissions(p_permissions jsonb)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'calendario', coalesce((p_permissions ->> 'calendario')::boolean, false),
    'finanzas',   coalesce((p_permissions ->> 'finanzas')::boolean, false),
    'crm',        coalesce((p_permissions ->> 'crm')::boolean, false),
    'documentos', coalesce((p_permissions ->> 'documentos')::boolean, false)
  );
$$;

create or replace function private.mc_is_staff_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.mc_profiles
    where id = auth.uid()
      and role in ('superadmin', 'empleado')
  );
$$;

create or replace function private.mc_has_employee_permission(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.mc_profiles
    where id = auth.uid()
      and role = 'empleado'
      and coalesce((employee_permissions ->> p_key)::boolean, false) = true
  );
$$;

create or replace function private.mc_has_admin_module_access(p_module text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    private.mc_is_superadmin()
    or (
      p_module <> 'empleados'
      and private.mc_has_employee_permission(p_module)
    );
$$;

revoke all on function private.mc_sanitize_employee_permissions(jsonb) from public;
revoke all on function private.mc_is_staff_member() from public;
revoke all on function private.mc_has_employee_permission(text) from public;
revoke all on function private.mc_has_admin_module_access(text) from public;
grant execute on function private.mc_is_staff_member() to authenticated;
grant execute on function private.mc_has_employee_permission(text) to authenticated;
grant execute on function private.mc_has_admin_module_access(text) to authenticated;

-- A signed-in user can update their own mc_profiles row. Keep role and staff
-- columns under the superadmin RPCs.
create or replace function private.mc_guard_staff_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if private.mc_is_superadmin() then
    return new;
  end if;
  new.role := old.role;
  new.employee_permissions := old.employee_permissions;
  new.job_title := old.job_title;
  new.work_email := old.work_email;
  new.calendly_url := old.calendly_url;
  return new;
end;
$$;

drop trigger if exists mc_profiles_guard_staff_columns on public.mc_profiles;
create trigger mc_profiles_guard_staff_columns
  before update on public.mc_profiles
  for each row
  execute function private.mc_guard_staff_columns();

-- -----------------------------------------------------------------------------
-- Calendario
-- -----------------------------------------------------------------------------
create table if not exists public.mc_time_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.mc_profiles(id) on delete cascade,
  work_date  date not null default current_date,
  clock_in   timestamptz not null,
  clock_out  timestamptz,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mc_time_entries_user_date_idx
  on public.mc_time_entries (user_id, work_date desc);

create table if not exists public.mc_absence_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.mc_profiles(id) on delete cascade,
  start_date   date not null,
  end_date     date not null,
  absence_type public.mc_absence_type not null default 'pending',
  status       public.mc_absence_status not null default 'pending',
  notes        text,
  created_by   uuid references public.mc_profiles(id),
  approved_by  uuid references public.mc_profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint mc_absence_dates_valid check (end_date >= start_date)
);

create index if not exists mc_absence_requests_user_idx
  on public.mc_absence_requests (user_id, start_date);

create table if not exists public.mc_festivos (
  id         uuid primary key default gen_random_uuid(),
  fecha      date not null unique,
  nombre     text not null,
  created_by uuid references public.mc_profiles(id),
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Documentos
-- -----------------------------------------------------------------------------
create table if not exists public.mc_admin_documents (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  url        text not null,
  section    text not null default 'General',
  created_by uuid references public.mc_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mc_admin_documents_section_idx
  on public.mc_admin_documents (section, title);

-- -----------------------------------------------------------------------------
-- Finanzas
-- -----------------------------------------------------------------------------
create table if not exists public.mc_expenses (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  amount       numeric(12, 2) not null check (amount >= 0),
  category     public.mc_expense_category not null,
  expense_date date not null default current_date,
  billing_date date default current_date,
  payment_date date,
  external_id  text unique,
  provider     text not null default 'manual',
  description  text,
  created_by   uuid references public.mc_profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint mc_expenses_provider_check
    check (provider in ('manual', 'openai', 'hetzner', 'cloudflare'))
);

create index if not exists mc_expenses_billing_date_idx on public.mc_expenses (billing_date desc);
create index if not exists mc_expenses_provider_idx on public.mc_expenses (provider);

-- -----------------------------------------------------------------------------
-- CRM
-- -----------------------------------------------------------------------------
create table if not exists public.mc_crm_leads (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null,
  apellido         text not null default '',
  email            text not null default '',
  empresa          text not null default '',
  cif              text,
  comercial_id     uuid references public.mc_profiles(id) on delete set null,
  fase             public.mc_lead_phase not null default 'nuevo',
  ultimo_contacto  date,
  proximo_contacto date,
  contact_count    integer not null default 0,
  comentarios      text,
  is_converted     boolean not null default false,
  web              text,
  linkedin_url     text,
  cargo            text,
  region           text,
  tipo_cuenta      text not null default 'empresa',
  prioridad        text not null default 'C',
  gancho           text,
  plan_objetivo    text not null default 'business',
  fuente           text not null default 'manual',
  email_copy       text,
  linkedin_copy    text,
  archived         boolean not null default false,
  quality_flag     text not null default 'ok',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint mc_crm_leads_contact_count_chk check (contact_count >= 0 and contact_count <= 50),
  constraint mc_crm_leads_tipo_cuenta_chk check (tipo_cuenta in ('consultora', 'empresa', 'organismo', 'otro')),
  constraint mc_crm_leads_prioridad_chk check (prioridad in ('A', 'B', 'C')),
  constraint mc_crm_leads_plan_objetivo_chk check (plan_objetivo in (
    'starter', 'business', 'enterprise', 'profesional', 'free'
  )),
  constraint mc_crm_leads_fuente_chk check (fuente in (
    'outbound_consultoras', 'import_2026_07', 'inbound', 'manual', 'referral',
    'resoluciones_prospeccion', 'ai_sdr'
  )),
  constraint mc_crm_leads_quality_flag_chk check (quality_flag in (
    'ok', 'needs_review', 'junk', 'pendiente_correo'
  ))
);

create index if not exists mc_crm_leads_comercial_idx on public.mc_crm_leads (comercial_id);
create index if not exists mc_crm_leads_fase_idx on public.mc_crm_leads (fase);
create index if not exists mc_crm_leads_pipeline_idx
  on public.mc_crm_leads (archived, prioridad, fase, proximo_contacto);

create table if not exists public.mc_crm_activities (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references public.mc_crm_leads(id) on delete cascade,
  tipo          text not null,
  contenido     text not null default '',
  scheduled_for date,
  completed_at  timestamptz,
  created_by    uuid references public.mc_profiles(id),
  created_at    timestamptz not null default now(),
  constraint mc_crm_activities_tipo_chk check (tipo in (
    'nota', 'email', 'linkedin', 'llamada', 'demo', 'seguimiento', 'post_demo'
  ))
);

create index if not exists mc_crm_activities_lead_idx
  on public.mc_crm_activities (lead_id, created_at desc);

create table if not exists public.mc_crm_playbook (
  key        text primary key,
  title      text not null,
  body       text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.mc_crm_incidents (
  id          uuid primary key default gen_random_uuid(),
  cliente     text not null,
  descripcion text not null,
  estado      public.mc_incident_status not null default 'abierta',
  prioridad   public.mc_incident_priority not null default 'media',
  fecha       date not null default current_date,
  created_by  uuid references public.mc_profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.mc_crm_followup_settings (
  id            smallint primary key default 1 check (id = 1),
  followup_days integer[] not null default array[3, 7, 14],
  updated_at    timestamptz not null default now()
);

insert into public.mc_crm_followup_settings (id, followup_days)
values (1, array[3, 7, 14])
on conflict (id) do nothing;

create or replace function private.mc_crm_clear_proximo_when_converted()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.fase = 'convertido' or new.is_converted then
    new.proximo_contacto := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists mc_crm_leads_converted_clear_proximo on public.mc_crm_leads;
create trigger mc_crm_leads_converted_clear_proximo
  before insert or update on public.mc_crm_leads
  for each row
  execute function private.mc_crm_clear_proximo_when_converted();

create or replace function public.mc_crm_next_contact_date(
  p_from date,
  p_contact_count integer,
  p_days integer[] default null
)
returns date
language plpgsql
stable
set search_path = public
as $$
declare
  days integer[];
  idx int;
  wait int;
begin
  days := p_days;
  if days is null or cardinality(days) = 0 then
    select followup_days into days
    from public.mc_crm_followup_settings
    where id = 1;
  end if;
  if days is null or cardinality(days) = 0 then
    days := array[3, 7, 14];
  end if;

  idx := greatest(1, least(coalesce(p_contact_count, 1), cardinality(days)));
  wait := days[idx];
  return p_from + wait;
end;
$$;

create or replace function public.mc_crm_schedule_followups(
  p_lead_id uuid,
  p_from date default current_date
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  d int;
  days integer[];
  v_count int;
  v_next date;
begin
  if not private.mc_has_admin_module_access('crm') then
    raise exception 'not authorized';
  end if;

  select followup_days into days
  from public.mc_crm_followup_settings
  where id = 1;

  if days is null or cardinality(days) = 0 then
    days := array[3, 7, 14];
  end if;

  select coalesce(contact_count, 0) + 1 into v_count
  from public.mc_crm_leads
  where id = p_lead_id;

  if v_count is null then
    raise exception 'lead not found';
  end if;

  v_next := public.mc_crm_next_contact_date(p_from, v_count, days);

  foreach d in array days loop
    insert into public.mc_crm_activities (lead_id, tipo, contenido, scheduled_for, created_by)
    select
      p_lead_id,
      'seguimiento',
      format('Seguimiento tras contacto #%s (+%s días)', v_count, d),
      p_from + d,
      auth.uid()
    where not exists (
      select 1
      from public.mc_crm_activities a
      where a.lead_id = p_lead_id
        and a.tipo = 'seguimiento'
        and a.scheduled_for = p_from + d
        and a.completed_at is null
    );
  end loop;

  update public.mc_crm_leads
  set
    contact_count = v_count,
    ultimo_contacto = p_from,
    proximo_contacto = v_next,
    fase = case when fase = 'nuevo' then 'contactado'::public.mc_lead_phase else fase end
  where id = p_lead_id;
end;
$$;

revoke all on function public.mc_crm_next_contact_date(date, integer, integer[]) from public;
revoke all on function public.mc_crm_schedule_followups(uuid, date) from public;
grant execute on function public.mc_crm_next_contact_date(date, integer, integer[]) to authenticated;
grant execute on function public.mc_crm_schedule_followups(uuid, date) to authenticated;

-- -----------------------------------------------------------------------------
-- Empleados
-- -----------------------------------------------------------------------------
create or replace function public.mc_list_employee_profiles()
returns table (
  user_id uuid,
  full_name text,
  company_name text,
  email text,
  role text,
  employee_permissions jsonb,
  created_at timestamptz,
  job_title text,
  work_email text,
  calendly_url text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not private.mc_is_superadmin() then
    raise exception 'Sin permisos';
  end if;

  return query
  select
    p.id,
    coalesce(p.full_name, ''),
    coalesce(o.name, ''),
    coalesce(u.email, '')::text,
    p.role::text,
    p.employee_permissions,
    p.created_at,
    p.job_title,
    p.work_email,
    p.calendly_url
  from public.mc_profiles p
  left join public.mc_organizations o on o.id = p.organization_id
  left join auth.users u on u.id = p.id
  where p.role in ('empleado', 'superadmin')
  order by
    case p.role when 'superadmin' then 0 else 1 end,
    case when coalesce(p.full_name, '') = '' then 1 else 0 end,
    p.full_name asc nulls last;
end;
$$;

create or replace function public.mc_search_users_for_employee(
  p_query text default '',
  p_limit integer default 12
)
returns table (
  user_id uuid,
  full_name text,
  company_name text,
  email text,
  role text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q text := lower(trim(coalesce(p_query, '')));
begin
  if not private.mc_is_superadmin() then
    raise exception 'Sin permisos';
  end if;

  return query
  select
    p.id,
    coalesce(p.full_name, ''),
    coalesce(o.name, ''),
    coalesce(u.email, '')::text,
    p.role::text
  from public.mc_profiles p
  left join public.mc_organizations o on o.id = p.organization_id
  left join auth.users u on u.id = p.id
  where p.role not in ('superadmin', 'empleado')
    and (
      v_q = ''
      or lower(coalesce(p.full_name, '')) like '%' || v_q || '%'
      or lower(coalesce(o.name, '')) like '%' || v_q || '%'
      or lower(coalesce(u.email, '')) like '%' || v_q || '%'
    )
  order by
    case when coalesce(p.full_name, '') = '' then 1 else 0 end,
    p.full_name asc nulls last
  limit greatest(1, least(coalesce(p_limit, 12), 50));
end;
$$;

create or replace function public.mc_set_user_as_employee(
  p_user_id uuid,
  p_permissions jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.mc_app_role;
begin
  if not private.mc_is_superadmin() then
    raise exception 'Sin permisos';
  end if;

  if p_user_id is null then
    raise exception 'user_id requerido';
  end if;

  select role into v_role from public.mc_profiles where id = p_user_id;
  if v_role is null then
    raise exception 'Perfil no encontrado';
  end if;

  if v_role = 'superadmin' then
    raise exception 'No se puede convertir un superadmin en empleado';
  end if;

  update public.mc_profiles
  set
    role = 'empleado',
    employee_permissions = private.mc_sanitize_employee_permissions(p_permissions),
    updated_at = now()
  where id = p_user_id;
end;
$$;

create or replace function public.mc_update_employee_permissions(
  p_user_id uuid,
  p_permissions jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.mc_app_role;
begin
  if not private.mc_is_superadmin() then
    raise exception 'Sin permisos';
  end if;

  select role into v_role from public.mc_profiles where id = p_user_id;
  if v_role is distinct from 'empleado' then
    raise exception 'El usuario no es empleado';
  end if;

  update public.mc_profiles
  set
    employee_permissions = private.mc_sanitize_employee_permissions(p_permissions),
    updated_at = now()
  where id = p_user_id;
end;
$$;

create or replace function public.mc_demote_employee_to_client(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.mc_app_role;
begin
  if not private.mc_is_superadmin() then
    raise exception 'Sin permisos';
  end if;

  select role into v_role from public.mc_profiles where id = p_user_id;
  if v_role is distinct from 'empleado' then
    raise exception 'El usuario no es empleado';
  end if;

  update public.mc_profiles
  set
    role = 'client',
    employee_permissions = '{}'::jsonb,
    updated_at = now()
  where id = p_user_id;
end;
$$;

create or replace function public.mc_update_employee_commercial_identity(
  p_user_id uuid,
  p_full_name text,
  p_job_title text,
  p_work_email text,
  p_calendly_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
begin
  if not private.mc_is_superadmin() then
    raise exception 'Sin permisos';
  end if;

  v_url := nullif(trim(p_calendly_url), '');
  if v_url is not null and v_url !~* '^https://' then
    raise exception 'El calendario tiene que ser una URL https de Cal.com o Calendly';
  end if;

  update public.mc_profiles
  set
    full_name = nullif(trim(p_full_name), ''),
    job_title = nullif(trim(p_job_title), ''),
    work_email = nullif(lower(trim(p_work_email)), ''),
    calendly_url = v_url,
    updated_at = now()
  where id = p_user_id
    and role in ('empleado', 'superadmin');

  if not found then
    raise exception 'Empleado no encontrado';
  end if;
end;
$$;

create or replace function public.mc_search_client_profiles(
  p_query text default '',
  p_limit integer default 12
)
returns table (
  user_id uuid,
  full_name text,
  company_name text,
  email text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q text := lower(trim(coalesce(p_query, '')));
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  if not private.mc_has_admin_module_access('crm') then
    raise exception 'Sin permisos';
  end if;

  return query
  select
    p.id,
    coalesce(p.full_name, ''),
    coalesce(o.name, ''),
    coalesce(u.email, '')::text
  from public.mc_profiles p
  left join public.mc_organizations o on o.id = p.organization_id
  left join auth.users u on u.id = p.id
  where p.role = 'client'
    and (
      v_q = ''
      or lower(coalesce(p.full_name, '')) like '%' || v_q || '%'
      or lower(coalesce(o.name, '')) like '%' || v_q || '%'
      or lower(coalesce(u.email, '')) like '%' || v_q || '%'
      or lower(p.id::text) like '%' || v_q || '%'
    )
  order by
    case when coalesce(p.full_name, '') = '' then 1 else 0 end,
    p.full_name asc nulls last,
    u.email asc nulls last
  limit greatest(1, least(coalesce(p_limit, 12), 50));
end;
$$;

create or replace function public.mc_list_platform_clients()
returns table (
  user_id uuid,
  full_name text,
  company_name text,
  email text,
  plan_type text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not private.mc_has_admin_module_access('crm') then
    raise exception 'Sin permisos';
  end if;

  return query
  select
    p.id,
    coalesce(p.full_name, ''),
    coalesce(o.name, ''),
    coalesce(u.email, '')::text,
    coalesce(o.plan::text, 'starter'),
    p.created_at
  from public.mc_profiles p
  left join public.mc_organizations o on o.id = p.organization_id
  left join auth.users u on u.id = p.id
  where p.role = 'client'
  order by p.created_at desc
  limit 500;
end;
$$;

create or replace function public.mc_crm_client_company_signals()
returns table (
  company_name text,
  email_domain text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not private.mc_has_admin_module_access('crm') then
    raise exception 'Sin permisos';
  end if;

  return query
  select distinct
    coalesce(o.name, ''),
    lower(split_part(coalesce(u.email, ''), '@', 2))
  from public.mc_profiles p
  left join public.mc_organizations o on o.id = p.organization_id
  left join auth.users u on u.id = p.id
  where p.role = 'client';
end;
$$;

revoke all on function public.mc_list_employee_profiles() from public;
revoke all on function public.mc_search_users_for_employee(text, integer) from public;
revoke all on function public.mc_set_user_as_employee(uuid, jsonb) from public;
revoke all on function public.mc_update_employee_permissions(uuid, jsonb) from public;
revoke all on function public.mc_demote_employee_to_client(uuid) from public;
revoke all on function public.mc_update_employee_commercial_identity(uuid, text, text, text, text) from public;
revoke all on function public.mc_search_client_profiles(text, integer) from public;
revoke all on function public.mc_list_platform_clients() from public;
revoke all on function public.mc_crm_client_company_signals() from public;

grant execute on function public.mc_list_employee_profiles() to authenticated;
grant execute on function public.mc_search_users_for_employee(text, integer) to authenticated;
grant execute on function public.mc_set_user_as_employee(uuid, jsonb) to authenticated;
grant execute on function public.mc_update_employee_permissions(uuid, jsonb) to authenticated;
grant execute on function public.mc_demote_employee_to_client(uuid) to authenticated;
grant execute on function public.mc_update_employee_commercial_identity(uuid, text, text, text, text) to authenticated;
grant execute on function public.mc_search_client_profiles(text, integer) to authenticated;
grant execute on function public.mc_list_platform_clients() to authenticated;
grant execute on function public.mc_crm_client_company_signals() to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.mc_time_entries enable row level security;
alter table public.mc_absence_requests enable row level security;
alter table public.mc_festivos enable row level security;
alter table public.mc_admin_documents enable row level security;
alter table public.mc_expenses enable row level security;
alter table public.mc_crm_leads enable row level security;
alter table public.mc_crm_activities enable row level security;
alter table public.mc_crm_playbook enable row level security;
alter table public.mc_crm_incidents enable row level security;
alter table public.mc_crm_followup_settings enable row level security;

drop policy if exists mc_time_entries_select on public.mc_time_entries;
create policy mc_time_entries_select
  on public.mc_time_entries for select to authenticated
  using (user_id = auth.uid() or private.mc_is_superadmin());

drop policy if exists mc_time_entries_insert on public.mc_time_entries;
create policy mc_time_entries_insert
  on public.mc_time_entries for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists mc_time_entries_update on public.mc_time_entries;
create policy mc_time_entries_update
  on public.mc_time_entries for update to authenticated
  using (user_id = auth.uid() or private.mc_is_superadmin())
  with check (user_id = auth.uid() or private.mc_is_superadmin());

drop policy if exists mc_time_entries_delete on public.mc_time_entries;
create policy mc_time_entries_delete
  on public.mc_time_entries for delete to authenticated
  using (user_id = auth.uid() or private.mc_is_superadmin());

drop policy if exists mc_absence_select on public.mc_absence_requests;
create policy mc_absence_select
  on public.mc_absence_requests for select to authenticated
  using (user_id = auth.uid() or private.mc_is_superadmin());

drop policy if exists mc_absence_insert on public.mc_absence_requests;
create policy mc_absence_insert
  on public.mc_absence_requests for insert to authenticated
  with check (
    private.mc_is_staff_member()
    and (user_id = auth.uid() or private.mc_is_superadmin())
  );

drop policy if exists mc_absence_update on public.mc_absence_requests;
create policy mc_absence_update
  on public.mc_absence_requests for update to authenticated
  using (user_id = auth.uid() or private.mc_is_superadmin())
  with check (user_id = auth.uid() or private.mc_is_superadmin());

drop policy if exists mc_absence_delete on public.mc_absence_requests;
create policy mc_absence_delete
  on public.mc_absence_requests for delete to authenticated
  using (user_id = auth.uid() or private.mc_is_superadmin());

drop policy if exists mc_festivos_select on public.mc_festivos;
create policy mc_festivos_select
  on public.mc_festivos for select to authenticated
  using (private.mc_is_staff_member());

drop policy if exists mc_festivos_write on public.mc_festivos;
create policy mc_festivos_write
  on public.mc_festivos for all to authenticated
  using (private.mc_is_superadmin())
  with check (private.mc_is_superadmin());

drop policy if exists mc_documents_select on public.mc_admin_documents;
create policy mc_documents_select
  on public.mc_admin_documents for select to authenticated
  using (private.mc_has_admin_module_access('documentos'));

drop policy if exists mc_documents_write on public.mc_admin_documents;
create policy mc_documents_write
  on public.mc_admin_documents for all to authenticated
  using (private.mc_has_admin_module_access('documentos'))
  with check (private.mc_has_admin_module_access('documentos'));

drop policy if exists mc_expenses_select on public.mc_expenses;
create policy mc_expenses_select
  on public.mc_expenses for select to authenticated
  using (private.mc_has_admin_module_access('finanzas'));

drop policy if exists mc_expenses_write on public.mc_expenses;
create policy mc_expenses_write
  on public.mc_expenses for all to authenticated
  using (private.mc_has_admin_module_access('finanzas'))
  with check (private.mc_has_admin_module_access('finanzas'));

drop policy if exists mc_crm_leads_select on public.mc_crm_leads;
create policy mc_crm_leads_select
  on public.mc_crm_leads for select to authenticated
  using (private.mc_has_admin_module_access('crm'));

drop policy if exists mc_crm_leads_write on public.mc_crm_leads;
create policy mc_crm_leads_write
  on public.mc_crm_leads for all to authenticated
  using (private.mc_has_admin_module_access('crm'))
  with check (private.mc_has_admin_module_access('crm'));

drop policy if exists mc_crm_activities_select on public.mc_crm_activities;
create policy mc_crm_activities_select
  on public.mc_crm_activities for select to authenticated
  using (private.mc_has_admin_module_access('crm'));

drop policy if exists mc_crm_activities_write on public.mc_crm_activities;
create policy mc_crm_activities_write
  on public.mc_crm_activities for all to authenticated
  using (private.mc_has_admin_module_access('crm'))
  with check (private.mc_has_admin_module_access('crm'));

drop policy if exists mc_crm_playbook_select on public.mc_crm_playbook;
create policy mc_crm_playbook_select
  on public.mc_crm_playbook for select to authenticated
  using (private.mc_has_admin_module_access('crm'));

drop policy if exists mc_crm_playbook_write on public.mc_crm_playbook;
create policy mc_crm_playbook_write
  on public.mc_crm_playbook for all to authenticated
  using (private.mc_has_admin_module_access('crm'))
  with check (private.mc_has_admin_module_access('crm'));

drop policy if exists mc_crm_incidents_select on public.mc_crm_incidents;
create policy mc_crm_incidents_select
  on public.mc_crm_incidents for select to authenticated
  using (private.mc_has_admin_module_access('crm'));

drop policy if exists mc_crm_incidents_write on public.mc_crm_incidents;
create policy mc_crm_incidents_write
  on public.mc_crm_incidents for all to authenticated
  using (private.mc_has_admin_module_access('crm'))
  with check (private.mc_has_admin_module_access('crm'));

drop policy if exists mc_crm_followup_select on public.mc_crm_followup_settings;
create policy mc_crm_followup_select
  on public.mc_crm_followup_settings for select to authenticated
  using (private.mc_has_admin_module_access('crm'));

drop policy if exists mc_crm_followup_write on public.mc_crm_followup_settings;
create policy mc_crm_followup_write
  on public.mc_crm_followup_settings for all to authenticated
  using (private.mc_has_admin_module_access('crm'))
  with check (private.mc_has_admin_module_access('crm'));

grant select, insert, update, delete on table
  public.mc_time_entries,
  public.mc_absence_requests,
  public.mc_festivos,
  public.mc_admin_documents,
  public.mc_expenses,
  public.mc_crm_leads,
  public.mc_crm_activities,
  public.mc_crm_playbook,
  public.mc_crm_incidents,
  public.mc_crm_followup_settings
to authenticated;

grant all on table
  public.mc_time_entries,
  public.mc_absence_requests,
  public.mc_festivos,
  public.mc_admin_documents,
  public.mc_expenses,
  public.mc_crm_leads,
  public.mc_crm_activities,
  public.mc_crm_playbook,
  public.mc_crm_incidents,
  public.mc_crm_followup_settings
to service_role;

notify pgrst, 'reload schema';
