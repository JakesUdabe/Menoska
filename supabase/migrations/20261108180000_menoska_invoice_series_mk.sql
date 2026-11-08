-- Menoska outbox on this product's own Supabase (nheyqairforzviwheyrq).
-- Serie MK. Does not create serie PZ. Issuer remains the autónomo via the shared worker.

create table if not exists public.billing_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text,
  legal_name text,
  tax_id text,
  tax_id_type text,
  billing_email text,
  address_line1 text,
  address_line2 text,
  postal_code text,
  city text,
  province text,
  country text default 'ES',
  fiscal_status text not null default 'incomplete'
    check (fiscal_status in ('complete', 'incomplete')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists billing_profiles_stripe_customer_id_key
  on public.billing_profiles (stripe_customer_id)
  where stripe_customer_id is not null;

alter table public.billing_profiles enable row level security;

drop policy if exists "billing_profiles_select_own" on public.billing_profiles;
create policy "billing_profiles_select_own"
  on public.billing_profiles for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "billing_profiles_update_own" on public.billing_profiles;
create policy "billing_profiles_update_own"
  on public.billing_profiles for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "billing_profiles_insert_own" on public.billing_profiles;
create policy "billing_profiles_insert_own"
  on public.billing_profiles for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "billing_profiles_service" on public.billing_profiles;
create policy "billing_profiles_service"
  on public.billing_profiles for all to service_role
  using (true) with check (true);

create table if not exists public.legal_invoice_series (
  serie text primary key,
  next_number integer not null default 1 check (next_number >= 1),
  updated_at timestamptz not null default now()
);

insert into public.legal_invoice_series (serie, next_number)
values ('MK', 1)
on conflict (serie) do nothing;

alter table public.legal_invoice_series enable row level security;

drop policy if exists "legal_invoice_series_service" on public.legal_invoice_series;
create policy "legal_invoice_series_service"
  on public.legal_invoice_series for all to service_role
  using (true) with check (true);

create or replace function public.allocate_legal_invoice_number(p_serie text default 'MK')
returns table (serie text, number integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number integer;
begin
  insert into public.legal_invoice_series as lis (serie, next_number)
  values (p_serie, 1)
  on conflict on constraint legal_invoice_series_pkey do nothing;

  update public.legal_invoice_series as lis
  set next_number = lis.next_number + 1,
      updated_at = now()
  where lis.serie = p_serie
  returning lis.next_number - 1 into v_number;

  if v_number is null then
    raise exception 'Unknown invoice serie: %', p_serie;
  end if;

  return query select p_serie::text, v_number;
end;
$$;

revoke all on function public.allocate_legal_invoice_number(text) from public;
grant execute on function public.allocate_legal_invoice_number(text) to service_role;

create table if not exists public.legal_invoices (
  id uuid primary key default gen_random_uuid(),
  stripe_invoice_id text not null,
  stripe_customer_id text,
  stripe_payment_intent_id text,
  stripe_refund_id text,
  user_id uuid references auth.users (id) on delete set null,
  currency text not null default 'eur',
  amount_subtotal integer not null default 0,
  amount_tax integer not null default 0,
  amount_total integer not null default 0,
  tax_rate_bps integer,
  tax_regime text not null default 'es_iva_21'
    check (tax_regime in (
      'es_iva_21', 'es_iva_10', 'es_iva_4', 'eu_reverse_charge', 'export', 'exempt', 'unknown'
    )),
  buyer_legal_name text,
  buyer_tax_id text,
  buyer_tax_id_type text,
  buyer_email text,
  buyer_address_line1 text,
  buyer_address_line2 text,
  buyer_postal_code text,
  buyer_city text,
  buyer_province text,
  buyer_country text,
  serie text,
  number integer,
  issue_date date,
  tbai_id text,
  qr_url text,
  xml_sha256 text,
  signature_value text,
  xml_storage_path text,
  pdf_storage_path text,
  cancel_xml_storage_path text,
  cancel_signature_value text,
  chain_prev_tbai text,
  description text,
  product_brand text,
  dry_run_alta boolean not null default false,
  voided_at timestamptz,
  status text not null default 'queued'
    check (status in (
      'pending_fiscal_data', 'queued', 'signing', 'sent_hacienda',
      'pdf_ready', 'emailed', 'failed', 'cancelled',
      'void_queued', 'voiding', 'voided'
    )),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legal_invoices_stripe_invoice_id_key unique (stripe_invoice_id),
  constraint legal_invoices_serie_number_key unique (serie, number)
);

create unique index if not exists legal_invoices_stripe_payment_intent_id_key
  on public.legal_invoices (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create unique index if not exists legal_invoices_stripe_refund_id_key
  on public.legal_invoices (stripe_refund_id)
  where stripe_refund_id is not null;

create index if not exists legal_invoices_user_id_idx on public.legal_invoices (user_id);
create index if not exists legal_invoices_status_idx on public.legal_invoices (status);

comment on column public.legal_invoices.product_brand is
  'Stripe metadata.project. Missing project is not invoiced as another brand.';
comment on column public.legal_invoices.dry_run_alta is
  'true when the worker signed locally and did not send the alta to Hacienda.';

alter table public.legal_invoices enable row level security;

drop policy if exists "legal_invoices_select_own" on public.legal_invoices;
create policy "legal_invoices_select_own"
  on public.legal_invoices for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "legal_invoices_service" on public.legal_invoices;
create policy "legal_invoices_service"
  on public.legal_invoices for all to service_role
  using (true) with check (true);

create table if not exists public.fakturabai_jobs (
  id uuid primary key default gen_random_uuid(),
  legal_invoice_id uuid not null references public.legal_invoices (id) on delete cascade,
  job_kind text not null default 'issue' check (job_kind in ('issue', 'cancel')),
  attempt integer not null default 0,
  max_attempts integer not null default 8,
  next_run_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'done', 'dead')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists fakturabai_jobs_legal_invoice_active_uidx
  on public.fakturabai_jobs (legal_invoice_id)
  where status in ('pending', 'processing');

create index if not exists fakturabai_jobs_claim_idx
  on public.fakturabai_jobs (status, next_run_at)
  where status = 'pending';

alter table public.fakturabai_jobs enable row level security;

drop policy if exists "fakturabai_jobs_service" on public.fakturabai_jobs;
create policy "fakturabai_jobs_service"
  on public.fakturabai_jobs for all to service_role
  using (true) with check (true);

create or replace function public.claim_fakturabai_jobs(
  p_worker_id text,
  p_limit integer default 5,
  p_lease_seconds integer default 600
)
returns setof public.fakturabai_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select j.id
    from public.fakturabai_jobs j
    where j.status = 'pending'
      and j.next_run_at <= now()
      and (j.locked_at is null or j.locked_at < now() - make_interval(secs => p_lease_seconds))
    order by j.next_run_at asc
    for update skip locked
    limit greatest(1, least(p_limit, 50))
  )
  update public.fakturabai_jobs j
  set status = 'processing',
      locked_at = now(),
      locked_by = p_worker_id,
      attempt = j.attempt + 1,
      updated_at = now()
  from candidates c
  where j.id = c.id
  returning j.*;
end;
$$;

revoke all on function public.claim_fakturabai_jobs(text, integer, integer) from public;
grant execute on function public.claim_fakturabai_jobs(text, integer, integer) to service_role;

create or replace function public.enqueue_legal_invoice_cancel(
  p_legal_invoice_id uuid,
  p_stripe_refund_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_tbai text;
  v_job_id uuid;
begin
  select status, tbai_id into v_status, v_tbai
  from public.legal_invoices
  where id = p_legal_invoice_id
  for update;

  if not found then
    raise exception 'legal_invoice not found: %', p_legal_invoice_id;
  end if;

  if v_status in ('voided', 'cancelled') then
    return null;
  end if;

  if v_status in ('void_queued', 'voiding') then
    select id into v_job_id
    from public.fakturabai_jobs
    where legal_invoice_id = p_legal_invoice_id
      and job_kind = 'cancel'
      and status in ('pending', 'processing')
    limit 1;
    return v_job_id;
  end if;

  update public.fakturabai_jobs
  set status = 'done',
      last_error = coalesce(last_error, 'superseded by refund/cancel'),
      locked_at = null,
      locked_by = null,
      updated_at = now()
  where legal_invoice_id = p_legal_invoice_id
    and coalesce(job_kind, 'issue') = 'issue'
    and status in ('pending', 'processing');

  if v_tbai is null or btrim(v_tbai) = '' then
    update public.legal_invoices
    set status = 'cancelled',
        stripe_refund_id = coalesce(p_stripe_refund_id, stripe_refund_id),
        voided_at = now(),
        last_error = null,
        updated_at = now()
    where id = p_legal_invoice_id;
    return null;
  end if;

  update public.legal_invoices
  set status = 'void_queued',
      stripe_refund_id = coalesce(p_stripe_refund_id, stripe_refund_id),
      last_error = null,
      updated_at = now()
  where id = p_legal_invoice_id;

  insert into public.fakturabai_jobs (legal_invoice_id, job_kind, status, next_run_at)
  values (p_legal_invoice_id, 'cancel', 'pending', now())
  returning id into v_job_id;

  return v_job_id;
end;
$$;

revoke all on function public.enqueue_legal_invoice_cancel(uuid, text) from public;
grant execute on function public.enqueue_legal_invoice_cancel(uuid, text) to service_role;

create or replace function public.mc_assign_menoska_invoice_serie()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_serie text;
  v_number integer;
begin
  if new.product_brand = 'menoska' and new.number is null then
    select allocated.serie, allocated.number
      into v_serie, v_number
    from public.allocate_legal_invoice_number('MK') as allocated;
    new.serie := v_serie;
    new.number := v_number;
    new.issue_date := coalesce(new.issue_date, current_date);
  end if;
  return new;
end;
$$;

drop trigger if exists mc_legal_invoice_menoska_serie on public.legal_invoices;
create trigger mc_legal_invoice_menoska_serie
  before insert on public.legal_invoices
  for each row
  execute function public.mc_assign_menoska_invoice_serie();

create table if not exists public.mc_stripe_events (
  id text primary key,
  created_at timestamptz not null default now()
);

alter table public.mc_stripe_events enable row level security;

drop policy if exists "mc_stripe_events_service" on public.mc_stripe_events;
create policy "mc_stripe_events_service"
  on public.mc_stripe_events for all to service_role
  using (true) with check (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'legal-invoices',
  'legal-invoices',
  false,
  20971520,
  array['application/pdf', 'application/xml', 'text/xml', 'application/octet-stream']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "legal_invoices_storage_select_own" on storage.objects;
create policy "legal_invoices_storage_select_own"
on storage.objects for select to authenticated
using (
  bucket_id = 'legal-invoices'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "legal_invoices_storage_service" on storage.objects;
create policy "legal_invoices_storage_service"
on storage.objects for all to service_role
using (bucket_id = 'legal-invoices')
with check (bucket_id = 'legal-invoices');
