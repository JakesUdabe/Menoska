-- Legacy public objects belong to the previous product. This project does not use them.
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_created_menoska on auth.users;

do $$
declare
  r record;
begin
  for r in
    select c.relname, c.relkind
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('m', 'v')
  loop
    if r.relkind = 'm' then
      execute format('drop materialized view if exists public.%I cascade', r.relname);
    else
      execute format('drop view if exists public.%I cascade', r.relname);
    end if;
  end loop;

  for r in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('drop table if exists public.%I cascade', r.tablename);
  end loop;

  for r in
    select p.oid::regprocedure::text as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
    where n.nspname = 'public' and d.objid is null
  loop
    begin
      execute format('drop function if exists %s cascade', r.sig);
    exception
      when others then
        null;
    end;
  end loop;
end $$;

create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'client')),
  first_name text not null default '',
  last_name text not null default '',
  nif text,
  email text not null,
  created_at timestamptz not null default now()
);

create unique index profiles_nif_unique on public.profiles (nif) where nif is not null;

create table public.site_settings (
  id int primary key default 1 check (id = 1),
  hero_image_url text not null default '/images/hero.jpg',
  about_image_url text not null default '/images/jakes.svg',
  stat_1_value integer not null default 90,
  stat_1_prefix text not null default '+',
  stat_1_suffix text not null default '%',
  stat_2_value integer not null default 4,
  stat_2_prefix text not null default '+',
  stat_2_suffix text not null default ' M€',
  stat_3_value integer not null default 1,
  stat_3_prefix text not null default '+',
  stat_3_suffix text not null default ' M€',
  stat_4_value integer not null default 10,
  stat_4_prefix text not null default '+',
  stat_4_suffix text not null default ''
);

create table public.trajectory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  href text not null,
  logo_url text,
  sort_order integer not null default 0
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  role text not null default '',
  bio text not null default '',
  image_url text not null default '/images/jakes.svg',
  linkedin text,
  summary text not null default '',
  experience jsonb not null default '[]'::jsonb,
  education jsonb not null default '[]'::jsonb,
  credentials jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  visible boolean not null default true
);

create table public.module_entries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  module text not null check (module in ('growth', 'treasury', 'capital', 'tax', 'revenue', 'funding')),
  kind text not null check (kind in ('kpi', 'report')),
  title text not null,
  body text not null default '',
  value text not null default '',
  unit text not null default '',
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create index module_entries_client_idx on public.module_entries (client_id, module, kind, sort_order);

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role, first_name, last_name, nif, email)
  values (
    new.id,
    case
      when new.raw_app_meta_data ->> 'role' = 'admin' then 'admin'
      else 'client'
    end,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    nullif(new.raw_user_meta_data ->> 'nif', ''),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_profile_user_created on auth.users;
create trigger on_profile_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

alter table public.profiles enable row level security;
alter table public.site_settings enable row level security;
alter table public.trajectory_items enable row level security;
alter table public.employees enable row level security;
alter table public.module_entries enable row level security;

grant select on public.site_settings, public.trajectory_items, public.employees to anon, authenticated;
grant select, insert, update, delete on public.site_settings, public.trajectory_items, public.employees to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.module_entries to authenticated;

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or private.is_admin());

create policy site_read on public.site_settings
  for select to anon, authenticated
  using (true);

create policy site_write on public.site_settings
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy trajectory_read on public.trajectory_items
  for select to anon, authenticated
  using (true);

create policy trajectory_write on public.trajectory_items
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy employees_read on public.employees
  for select to anon, authenticated
  using (visible or private.is_admin());

create policy employees_write on public.employees
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy entries_select on public.module_entries
  for select to authenticated
  using (client_id = (select auth.uid()) or private.is_admin());

create policy entries_insert on public.module_entries
  for insert to authenticated
  with check (private.is_admin());

create policy entries_update on public.module_entries
  for update to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy entries_delete on public.module_entries
  for delete to authenticated
  using (private.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site',
  'site',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists site_public_read on storage.objects;
drop policy if exists site_admin_insert on storage.objects;
drop policy if exists site_admin_update on storage.objects;
drop policy if exists site_admin_delete on storage.objects;

create policy site_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'site');

create policy site_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'site' and private.is_admin());

create policy site_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'site' and private.is_admin())
  with check (bucket_id = 'site' and private.is_admin());

create policy site_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'site' and private.is_admin());

insert into public.site_settings (id) values (1);

insert into public.trajectory_items (name, href, sort_order) values
  ('CIDETEC', 'https://www.cidetec.es/', 0),
  ('Bantec', 'https://www.bantec.es/', 1),
  ('POLYMAT', 'https://polymat.eu/', 2),
  ('CIC biomaGUNE', 'https://www.cicbiomagune.es/', 3),
  ('EHU', 'https://www.ehu.eus/', 4);

insert into public.employees (
  slug, name, role, bio, image_url, linkedin, summary, experience, education, credentials, sort_order
) values (
  'jakes-udabe',
  'Jakes Udabe Sánchez',
  'Socio fundador y partner',
  'Dirección financiera para monetizar, valorar y escalar activos tecnológicos e industriales. FMVA®. Une analítica de datos, finanzas corporativas, propiedad industrial y control de gestión.',
  '/images/jakes.svg',
  'https://www.linkedin.com/in/jakes-udabe-a38609193/',
  'Responsable estratégico y financiero, especializado en la monetización, la valoración y la escalabilidad de activos tecnológicos e industriales. Certificado FMVA® (Financial Modeling & Valuation Analyst). Combina analítica de datos con finanzas corporativas, gestión de propiedad industrial y control de gestión. Trayectoria en reducción de riesgo financiero y jurídico y en la obtención de más de 1,1 M€ de financiación estratégica. Conecta la viabilidad técnica con el retorno para la decisión de dirección.',
  $exp$[
    {"role":"Corporate Strategy & Financial Analyst","org":"CIDETEC","when":"Enero de 2025 — actualidad","text":"Como responsable de FP&A y estrategia corporativa, dirige la planificación financiera a largo plazo, la asignación de capital y el posicionamiento de activos de I+D. Diseña y sigue indicadores de dirección con Power BI y Python, evalúa tendencias de mercado y estructura financiación pública y privada no dilutiva. Realiza análisis de libertad de operación, valoración de propiedad industrial y viabilidad comercial para reducir riesgo y acelerar la transferencia y el licenciamiento."},
    {"role":"Senior Financial Strategy Consultant","org":"Bantec Consultores","when":"Febrero de 2024 — enero de 2025","text":"Asesoró a consejos en estructura de capital, due diligence y estrategia financiera de carteras de inversión en I+D. Estructuró y negoció ayudas a la innovación, capital no dilutivo e inversión privada. Definió el gobierno financiero de acuerdos tecnológicos y modelos de riesgo para proteger la caja y el retorno."},
    {"role":"Doctoral Researcher","org":"POLYMAT","when":"Septiembre de 2019 — febrero de 2024","text":"Combinó la investigación doctoral con la operación financiera, la transferencia y la creación de proyectos. Gestionó presupuestos de laboratorio, compras y propuestas de financiación. Impulsó el desarrollo de negocio de spin-offs deeptech y biotech en CIC biomaGUNE, con modelos a tres y cinco años y salida a mercado. Llevó la expansión internacional y la negociación técnica-comercial en Cimico, reportando al CEO."}
  ]$exp$::jsonb,
  $edu$[
    {"title":"Máster en Data Science","org":"Universidad Camilo José Cela","when":"Septiembre de 2025 — julio de 2026","text":"Analítica predictiva y aprendizaje automático aplicados a las finanzas corporativas, con Python, SQL y modelos estadísticos para escenarios, asignación de capital y previsión."},
    {"title":"Doctorado cum laude en Química Aplicada","org":"EHU","when":"Septiembre de 2020 — junio de 2024","text":"Doctorado con mención cum laude, financiado por una beca del Fondo Social Europeo. Análisis de datos, gestión de proyectos y colaboración internacional, incluida una estancia en Queen’s University Belfast."},
    {"title":"MBA","org":"UNIR","when":"Diciembre de 2022 — febrero de 2024","text":"Finanzas corporativas, operaciones y liderazgo. Aplicado a transferencia tecnológica y modelos financieros en CIC biomaGUNE."},
    {"title":"Máster en Química y Polímeros","org":"EHU","when":"2019 — 2020","text":"Tecnología aplicada y paso de la investigación a entornos operativos. Base para juzgar la viabilidad, el retorno y el riesgo de activos tecnológicos."},
    {"title":"Grado en Química","org":"EHU","when":"2015 — 2019","text":"Metodología cuantitativa y experimentación, con una estancia de investigación en la Università degli Studi di Messina."}
  ]$edu$::jsonb,
  $cred$[
    {"title":"Capital Markets & Securities Analyst (CMSA®)","org":"Corporate Finance Institute","when":"Octubre de 2026 · 197550406"},
    {"title":"Financial Modeling & Valuation Analyst (FMVA®)","org":"Corporate Finance Institute","when":"Octubre de 2026 · 197522006"},
    {"title":"Financial Planning & Analysis Professional (FPAP)","org":"Corporate Finance Institute","when":"Octubre de 2026 · 197518818"},
    {"title":"Curso en gestión estratégica de patentes","org":"Mondragon Unibertsitatea","when":"Mayo de 2026"},
    {"title":"Harvard ManageMentor","org":"Harvard Business School","when":"Junio de 2023 · 7720230601247"}
  ]$cred$::jsonb,
  0
);
