-- =============================================================================
-- Admin core portable — esquema general
-- Origen: Proposalyze (Menoska Consulting), forma viva a 2026-11-08
--
-- Incluye: RBAC staff, calendario, documentos, finanzas (gastos), CRM núcleo.
-- No incluye: convocatorias, resoluciones, partners, créditos, memorias, AI SDR.
--
-- Requisitos del proyecto destino (ajusta nombres si no coinciden; ver ADAPT.md):
--   * public.profiles (user_id uuid PK → auth.users, role text, full_name,
--     company_name, created_at, updated_at)
--   * rol de superadmin = 'admin'
--   * rol de empleado  = 'empleado'
--   * rol de cliente   = 'cliente'  (solo lo usa demote_employee_to_cliente)
--
-- Idempotente: se puede volver a ejecutar sobre una base vacía de estas tablas.
-- Si el destino ya tiene estas tablas con otra forma, no las reescribas a ciegas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.absence_type AS ENUM (
    'vacation', 'sick_leave', 'maternity', 'justified', 'pending'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.absence_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.expense_category AS ENUM (
    'recurrent', 'payroll', 'one_time', 'interest', 'tax', 'depreciation', 'amortization'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.lead_phase AS ENUM (
    'nuevo', 'contactado', 'propuesta', 'negociacion', 'convertido', 'perdido'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.incident_status AS ENUM (
    'abierta', 'en_progreso', 'resuelta', 'cerrada'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.incident_priority AS ENUM ('baja', 'media', 'alta', 'critica');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Si el enum de gastos ya existía con menos valores (instalación antigua):
ALTER TYPE public.expense_category ADD VALUE IF NOT EXISTS 'interest';
ALTER TYPE public.expense_category ADD VALUE IF NOT EXISTS 'tax';
ALTER TYPE public.expense_category ADD VALUE IF NOT EXISTS 'depreciation';
ALTER TYPE public.expense_category ADD VALUE IF NOT EXISTS 'amortization';

-- -----------------------------------------------------------------------------
-- profiles: columnas que el admin general necesita
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS employee_permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS work_email text,
  ADD COLUMN IF NOT EXISTS calendly_url text;

COMMENT ON COLUMN public.profiles.employee_permissions IS
  'Permisos granulares cuando role = empleado. Keys de este kit: calendario, finanzas, crm, documentos, blog.';
COMMENT ON COLUMN public.profiles.calendly_url IS
  'URL https de Cal.com o Calendly. La edita el superadmin en Empleados.';

-- -----------------------------------------------------------------------------
-- RBAC
-- Lista blanca ÚNICA. Si añades un módulo al frontend, añádelo aquí.
-- En origen, blog y resoluciones están en la UI pero set/update_employee_permissions
-- los descarta. Este kit no replica ese recorte.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sanitize_employee_permissions(p_permissions jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'calendario', coalesce((p_permissions ->> 'calendario')::boolean, false),
    'finanzas',   coalesce((p_permissions ->> 'finanzas')::boolean, false),
    'crm',        coalesce((p_permissions ->> 'crm')::boolean, false),
    'documentos', coalesce((p_permissions ->> 'documentos')::boolean, false),
    'blog',       coalesce((p_permissions ->> 'blog')::boolean, false)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'empleado')
  );
$$;

CREATE OR REPLACE FUNCTION public.has_employee_permission(p_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
      AND role = 'empleado'
      AND coalesce((employee_permissions ->> p_key)::boolean, false) = true
  );
$$;

-- El superadmin entra en todo. El empleado entra solo si tiene la key.
-- 'empleados' nunca se concede a un empleado: solo el superadmin gestiona staff.
CREATE OR REPLACE FUNCTION public.has_admin_module_access(p_module text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin()
    OR (
      p_module <> 'empleados'
      AND public.has_employee_permission(p_module)
    );
$$;

REVOKE ALL ON FUNCTION public.sanitize_employee_permissions(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_staff_member() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_employee_permission(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_admin_module_access(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff_member() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_employee_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_admin_module_access(text) TO authenticated;

-- -----------------------------------------------------------------------------
-- Calendario
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.time_entries (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_date  date NOT NULL DEFAULT CURRENT_DATE,
  clock_in   timestamptz NOT NULL,
  clock_out  timestamptz,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_time_entries_user_date
  ON public.time_entries (user_id, work_date DESC);

CREATE TABLE IF NOT EXISTS public.absence_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date   date NOT NULL,
  end_date     date NOT NULL,
  absence_type public.absence_type NOT NULL DEFAULT 'pending',
  status       public.absence_status NOT NULL DEFAULT 'pending',
  notes        text,
  created_by   uuid REFERENCES auth.users(id),
  approved_by  uuid REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT absence_dates_valid CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_absence_requests_user
  ON public.absence_requests (user_id, start_date);

CREATE TABLE IF NOT EXISTS public.festivos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha      date NOT NULL UNIQUE,
  nombre     text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Documentos internos (enlaces agrupados por sección, no el producto de memorias)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_documents (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  url        text NOT NULL,
  section    text NOT NULL DEFAULT 'General',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_documents_section
  ON public.admin_documents (section, title);

-- -----------------------------------------------------------------------------
-- Finanzas: gastos. Los ingresos Stripe viven en la Edge Function, no aquí.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expenses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  amount       numeric(12, 2) NOT NULL CHECK (amount >= 0),
  category     public.expense_category NOT NULL,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  billing_date date DEFAULT CURRENT_DATE,
  payment_date date,
  external_id  text UNIQUE,
  provider     text NOT NULL DEFAULT 'manual',
  description  text,
  created_by   uuid REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expenses_provider_check
    CHECK (provider IN ('manual', 'openai', 'hetzner', 'cloudflare'))
);

CREATE INDEX IF NOT EXISTS expenses_billing_date_idx ON public.expenses (billing_date DESC);
CREATE INDEX IF NOT EXISTS expenses_provider_idx ON public.expenses (provider);

-- -----------------------------------------------------------------------------
-- CRM núcleo
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_leads (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre           text NOT NULL,
  apellido         text NOT NULL DEFAULT '',
  email            text NOT NULL DEFAULT '',
  empresa          text NOT NULL DEFAULT '',
  cif              text,
  comercial_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  fase             public.lead_phase NOT NULL DEFAULT 'nuevo',
  ultimo_contacto  date,
  proximo_contacto date,
  contact_count    integer NOT NULL DEFAULT 0,
  comentarios      text,
  is_converted     boolean NOT NULL DEFAULT false,
  web              text,
  linkedin_url     text,
  cargo            text,
  region           text,
  tipo_cuenta      text NOT NULL DEFAULT 'empresa',
  prioridad        text NOT NULL DEFAULT 'C',
  gancho           text,
  plan_objetivo    text NOT NULL DEFAULT 'profesional',
  fuente           text NOT NULL DEFAULT 'manual',
  email_copy       text,
  linkedin_copy    text,
  archived         boolean NOT NULL DEFAULT false,
  quality_flag     text NOT NULL DEFAULT 'ok',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_leads_contact_count_chk CHECK (contact_count >= 0 AND contact_count <= 50),
  CONSTRAINT crm_leads_tipo_cuenta_chk CHECK (tipo_cuenta IN ('consultora', 'empresa', 'organismo', 'otro')),
  CONSTRAINT crm_leads_prioridad_chk CHECK (prioridad IN ('A', 'B', 'C')),
  CONSTRAINT crm_leads_plan_objetivo_chk CHECK (plan_objetivo IN ('business', 'profesional', 'free')),
  CONSTRAINT crm_leads_fuente_chk CHECK (fuente IN (
    'outbound_consultoras', 'import_2026_07', 'inbound', 'manual', 'referral',
    'resoluciones_prospeccion', 'ai_sdr'
  )),
  CONSTRAINT crm_leads_quality_flag_chk CHECK (quality_flag IN (
    'ok', 'needs_review', 'junk', 'pendiente_correo'
  ))
);

CREATE INDEX IF NOT EXISTS idx_crm_leads_comercial ON public.crm_leads (comercial_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_fase ON public.crm_leads (fase);
CREATE INDEX IF NOT EXISTS idx_crm_leads_pipeline
  ON public.crm_leads (archived, prioridad, fase, proximo_contacto);

CREATE TABLE IF NOT EXISTS public.crm_activities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  tipo          text NOT NULL,
  contenido     text NOT NULL DEFAULT '',
  scheduled_for date,
  completed_at  timestamptz,
  created_by    uuid REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_activities_tipo_chk CHECK (tipo IN (
    'nota', 'email', 'linkedin', 'llamada', 'demo', 'seguimiento', 'post_demo'
  ))
);

CREATE INDEX IF NOT EXISTS idx_crm_activities_lead ON public.crm_activities (lead_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.crm_playbook (
  key        text PRIMARY KEY,
  title      text NOT NULL,
  body       text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_incidents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente     text NOT NULL,
  descripcion text NOT NULL,
  estado      public.incident_status NOT NULL DEFAULT 'abierta',
  prioridad   public.incident_priority NOT NULL DEFAULT 'media',
  fecha       date NOT NULL DEFAULT CURRENT_DATE,
  created_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_followup_settings (
  id            smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  followup_days integer[] NOT NULL DEFAULT ARRAY[3, 7, 14],
  updated_at    timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.crm_followup_settings (id, followup_days)
VALUES (1, ARRAY[3, 7, 14])
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.crm_company_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_key  text NOT NULL,
  company_name text NOT NULL,
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  message      text,
  reviewed_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_company_requests_one_pending_uidx
  ON public.crm_company_requests (company_key, requester_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS crm_company_requests_status_idx
  ON public.crm_company_requests (status, created_at DESC);

-- Un lead convertido no conserva fecha de próximo contacto.
-- En origen era un arreglo de datos; aquí queda como regla.
CREATE OR REPLACE FUNCTION public.crm_clear_proximo_when_converted()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.fase = 'convertido' OR NEW.is_converted THEN
    NEW.proximo_contacto := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_leads_converted_clear_proximo ON public.crm_leads;
CREATE TRIGGER crm_leads_converted_clear_proximo
  BEFORE INSERT OR UPDATE ON public.crm_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.crm_clear_proximo_when_converted();

CREATE OR REPLACE FUNCTION public.crm_next_contact_date(
  p_from date,
  p_contact_count integer,
  p_days integer[] DEFAULT NULL
)
RETURNS date
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  days integer[];
  idx int;
  wait int;
BEGIN
  days := p_days;
  IF days IS NULL OR cardinality(days) = 0 THEN
    SELECT followup_days INTO days
    FROM public.crm_followup_settings
    WHERE id = 1;
  END IF;
  IF days IS NULL OR cardinality(days) = 0 THEN
    days := ARRAY[3, 7, 14];
  END IF;

  idx := GREATEST(1, LEAST(COALESCE(p_contact_count, 1), cardinality(days)));
  wait := days[idx];
  RETURN p_from + wait;
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_schedule_followups(
  p_lead_id uuid,
  p_from date DEFAULT CURRENT_DATE
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  d int;
  days integer[];
  v_count int;
  v_next date;
BEGIN
  IF NOT public.has_admin_module_access('crm') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT followup_days INTO days
  FROM public.crm_followup_settings
  WHERE id = 1;

  IF days IS NULL OR cardinality(days) = 0 THEN
    days := ARRAY[3, 7, 14];
  END IF;

  SELECT COALESCE(contact_count, 0) + 1 INTO v_count
  FROM public.crm_leads
  WHERE id = p_lead_id;

  IF v_count IS NULL THEN
    RAISE EXCEPTION 'lead not found';
  END IF;

  v_next := public.crm_next_contact_date(p_from, v_count, days);

  FOREACH d IN ARRAY days LOOP
    INSERT INTO public.crm_activities (lead_id, tipo, contenido, scheduled_for, created_by)
    SELECT
      p_lead_id,
      'seguimiento',
      format('Seguimiento tras contacto #%s (+%s días)', v_count, d),
      p_from + d,
      auth.uid()
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.crm_activities a
      WHERE a.lead_id = p_lead_id
        AND a.tipo = 'seguimiento'
        AND a.scheduled_for = p_from + d
        AND a.completed_at IS NULL
    );
  END LOOP;

  UPDATE public.crm_leads
  SET
    contact_count = v_count,
    ultimo_contacto = p_from,
    proximo_contacto = v_next,
    fase = CASE WHEN fase = 'nuevo' THEN 'contactado'::public.lead_phase ELSE fase END
  WHERE id = p_lead_id;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_next_contact_date(date, integer, integer[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_schedule_followups(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_next_contact_date(date, integer, integer[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_schedule_followups(uuid, date) TO authenticated;

-- -----------------------------------------------------------------------------
-- Empleados (solo superadmin)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_employee_profiles()
RETURNS TABLE (
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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Sin permisos';
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    p.full_name,
    p.company_name,
    coalesce(u.email, '')::text AS email,
    p.role,
    p.employee_permissions,
    p.created_at,
    p.job_title,
    p.work_email,
    p.calendly_url
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.user_id
  WHERE p.role IN ('empleado', 'admin')
  ORDER BY
    CASE p.role WHEN 'admin' THEN 0 ELSE 1 END,
    CASE WHEN coalesce(p.full_name, '') = '' THEN 1 ELSE 0 END,
    p.full_name ASC NULLS LAST;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_users_for_employee(
  p_query text DEFAULT '',
  p_limit integer DEFAULT 12
)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  company_name text,
  email text,
  role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q text := lower(trim(coalesce(p_query, '')));
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Sin permisos';
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    p.full_name,
    p.company_name,
    coalesce(u.email, '')::text AS email,
    p.role
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.user_id
  WHERE coalesce(p.role, 'cliente') NOT IN ('admin', 'empleado')
    AND (
      v_q = ''
      OR lower(coalesce(p.full_name, '')) LIKE '%' || v_q || '%'
      OR lower(coalesce(p.company_name, '')) LIKE '%' || v_q || '%'
      OR lower(coalesce(u.email, '')) LIKE '%' || v_q || '%'
    )
  ORDER BY
    CASE WHEN coalesce(p.full_name, '') = '' THEN 1 ELSE 0 END,
    p.full_name ASC NULLS LAST
  LIMIT greatest(1, least(coalesce(p_limit, 12), 50));
END;
$$;

CREATE OR REPLACE FUNCTION public.set_user_as_employee(
  p_user_id uuid,
  p_permissions jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Sin permisos';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id requerido';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE user_id = p_user_id;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Perfil no encontrado';
  END IF;

  IF v_role = 'admin' THEN
    RAISE EXCEPTION 'No se puede convertir un admin en empleado';
  END IF;

  UPDATE public.profiles
  SET
    role = 'empleado',
    employee_permissions = public.sanitize_employee_permissions(p_permissions),
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_employee_permissions(
  p_user_id uuid,
  p_permissions jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Sin permisos';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE user_id = p_user_id;
  IF v_role IS DISTINCT FROM 'empleado' THEN
    RAISE EXCEPTION 'El usuario no es empleado';
  END IF;

  UPDATE public.profiles
  SET
    employee_permissions = public.sanitize_employee_permissions(p_permissions),
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.demote_employee_to_cliente(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Sin permisos';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE user_id = p_user_id;
  IF v_role IS DISTINCT FROM 'empleado' THEN
    RAISE EXCEPTION 'El usuario no es empleado';
  END IF;

  UPDATE public.profiles
  SET
    role = 'cliente',
    employee_permissions = '{}'::jsonb,
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_employee_commercial_identity(
  p_user_id uuid,
  p_full_name text,
  p_job_title text,
  p_work_email text,
  p_calendly_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Sin permisos';
  END IF;

  v_url := nullif(trim(p_calendly_url), '');
  IF v_url IS NOT NULL AND v_url !~* '^https://' THEN
    RAISE EXCEPTION 'El calendario tiene que ser una URL https de Cal.com o Calendly';
  END IF;

  UPDATE public.profiles
  SET
    full_name = nullif(trim(p_full_name), ''),
    job_title = nullif(trim(p_job_title), ''),
    work_email = nullif(lower(trim(p_work_email)), ''),
    calendly_url = v_url,
    updated_at = now()
  WHERE user_id = p_user_id
    AND role IN ('empleado', 'admin');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empleado no encontrado';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_cliente_profiles(
  p_query text DEFAULT '',
  p_limit integer DEFAULT 12
)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  company_name text,
  email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q text := lower(trim(coalesce(p_query, '')));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF NOT public.has_admin_module_access('crm') THEN
    RAISE EXCEPTION 'Sin permisos';
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    p.full_name,
    p.company_name,
    coalesce(u.email, '')::text AS email
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.user_id
  WHERE coalesce(p.role, 'cliente') NOT IN ('admin', 'empleado')
    AND (
      v_q = ''
      OR lower(coalesce(p.full_name, '')) LIKE '%' || v_q || '%'
      OR lower(coalesce(p.company_name, '')) LIKE '%' || v_q || '%'
      OR lower(coalesce(u.email, '')) LIKE '%' || v_q || '%'
      OR lower(p.user_id::text) LIKE '%' || v_q || '%'
    )
  ORDER BY
    CASE WHEN coalesce(p.full_name, '') = '' THEN 1 ELSE 0 END,
    p.full_name ASC NULLS LAST,
    u.email ASC NULLS LAST
  LIMIT greatest(1, least(coalesce(p_limit, 12), 50));
END;
$$;

REVOKE ALL ON FUNCTION public.list_employee_profiles() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_users_for_employee(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_user_as_employee(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_employee_permissions(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.demote_employee_to_cliente(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_employee_commercial_identity(uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_cliente_profiles(text, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.list_employee_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_users_for_employee(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_as_employee(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_employee_permissions(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.demote_employee_to_cliente(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_employee_commercial_identity(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_cliente_profiles(text, integer) TO authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absence_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_playbook ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_followup_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_company_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own time entries" ON public.time_entries;
CREATE POLICY "Users view own time entries"
  ON public.time_entries FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS "Users manage own time entries" ON public.time_entries;
CREATE POLICY "Users manage own time entries"
  ON public.time_entries FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own time entries" ON public.time_entries;
CREATE POLICY "Users update own time entries"
  ON public.time_entries FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS "Users delete own time entries" ON public.time_entries;
CREATE POLICY "Users delete own time entries"
  ON public.time_entries FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS "Staff view absences" ON public.absence_requests;
CREATE POLICY "Staff view absences"
  ON public.absence_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS "Staff create own absences" ON public.absence_requests;
CREATE POLICY "Staff create own absences"
  ON public.absence_requests FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff_member()
    AND (user_id = auth.uid() OR public.is_super_admin())
  );

DROP POLICY IF EXISTS "Staff update absences" ON public.absence_requests;
CREATE POLICY "Staff update absences"
  ON public.absence_requests FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS "Staff delete absences" ON public.absence_requests;
CREATE POLICY "Staff delete absences"
  ON public.absence_requests FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS "Staff view festivos" ON public.festivos;
CREATE POLICY "Staff view festivos"
  ON public.festivos FOR SELECT TO authenticated
  USING (public.is_staff_member());

DROP POLICY IF EXISTS "Superadmin manage festivos" ON public.festivos;
CREATE POLICY "Superadmin manage festivos"
  ON public.festivos FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Staff view documents" ON public.admin_documents;
CREATE POLICY "Staff view documents"
  ON public.admin_documents FOR SELECT TO authenticated
  USING (public.has_admin_module_access('documentos'));

DROP POLICY IF EXISTS "Staff manage documents" ON public.admin_documents;
CREATE POLICY "Staff manage documents"
  ON public.admin_documents FOR ALL TO authenticated
  USING (public.has_admin_module_access('documentos'))
  WITH CHECK (public.has_admin_module_access('documentos'));

DROP POLICY IF EXISTS "Finance staff view expenses" ON public.expenses;
CREATE POLICY "Finance staff view expenses"
  ON public.expenses FOR SELECT TO authenticated
  USING (public.has_admin_module_access('finanzas'));

DROP POLICY IF EXISTS "Finance staff manage expenses" ON public.expenses;
CREATE POLICY "Finance staff manage expenses"
  ON public.expenses FOR ALL TO authenticated
  USING (public.has_admin_module_access('finanzas'))
  WITH CHECK (public.has_admin_module_access('finanzas'));

DROP POLICY IF EXISTS "CRM staff view leads" ON public.crm_leads;
CREATE POLICY "CRM staff view leads"
  ON public.crm_leads FOR SELECT TO authenticated
  USING (public.has_admin_module_access('crm'));

DROP POLICY IF EXISTS "CRM staff manage leads" ON public.crm_leads;
CREATE POLICY "CRM staff manage leads"
  ON public.crm_leads FOR ALL TO authenticated
  USING (public.has_admin_module_access('crm'))
  WITH CHECK (public.has_admin_module_access('crm'));

DROP POLICY IF EXISTS "CRM staff view activities" ON public.crm_activities;
CREATE POLICY "CRM staff view activities"
  ON public.crm_activities FOR SELECT TO authenticated
  USING (public.has_admin_module_access('crm'));

DROP POLICY IF EXISTS "CRM staff manage activities" ON public.crm_activities;
CREATE POLICY "CRM staff manage activities"
  ON public.crm_activities FOR ALL TO authenticated
  USING (public.has_admin_module_access('crm'))
  WITH CHECK (public.has_admin_module_access('crm'));

DROP POLICY IF EXISTS "CRM staff view playbook" ON public.crm_playbook;
CREATE POLICY "CRM staff view playbook"
  ON public.crm_playbook FOR SELECT TO authenticated
  USING (public.has_admin_module_access('crm'));

DROP POLICY IF EXISTS "CRM staff manage playbook" ON public.crm_playbook;
CREATE POLICY "CRM staff manage playbook"
  ON public.crm_playbook FOR ALL TO authenticated
  USING (public.has_admin_module_access('crm'))
  WITH CHECK (public.has_admin_module_access('crm'));

DROP POLICY IF EXISTS "CRM staff view incidents" ON public.crm_incidents;
CREATE POLICY "CRM staff view incidents"
  ON public.crm_incidents FOR SELECT TO authenticated
  USING (public.has_admin_module_access('crm'));

DROP POLICY IF EXISTS "CRM staff manage incidents" ON public.crm_incidents;
CREATE POLICY "CRM staff manage incidents"
  ON public.crm_incidents FOR ALL TO authenticated
  USING (public.has_admin_module_access('crm'))
  WITH CHECK (public.has_admin_module_access('crm'));

DROP POLICY IF EXISTS "CRM staff read followup settings" ON public.crm_followup_settings;
CREATE POLICY "CRM staff read followup settings"
  ON public.crm_followup_settings FOR SELECT TO authenticated
  USING (public.has_admin_module_access('crm'));

DROP POLICY IF EXISTS "CRM staff manage followup settings" ON public.crm_followup_settings;
CREATE POLICY "CRM staff manage followup settings"
  ON public.crm_followup_settings FOR ALL TO authenticated
  USING (public.has_admin_module_access('crm'))
  WITH CHECK (public.has_admin_module_access('crm'));

DROP POLICY IF EXISTS crm_company_requests_select ON public.crm_company_requests;
CREATE POLICY crm_company_requests_select
  ON public.crm_company_requests FOR SELECT TO authenticated
  USING (
    public.has_admin_module_access('crm')
    AND (public.is_super_admin() OR requester_id = auth.uid())
  );

DROP POLICY IF EXISTS crm_company_requests_insert ON public.crm_company_requests;
CREATE POLICY crm_company_requests_insert
  ON public.crm_company_requests FOR INSERT TO authenticated
  WITH CHECK (
    public.has_admin_module_access('crm')
    AND requester_id = auth.uid()
    AND NOT public.is_super_admin()
    AND status = 'pending'
  );

DROP POLICY IF EXISTS crm_company_requests_update ON public.crm_company_requests;
CREATE POLICY crm_company_requests_update
  ON public.crm_company_requests FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.time_entries,
  public.absence_requests,
  public.festivos,
  public.admin_documents,
  public.expenses,
  public.crm_leads,
  public.crm_activities,
  public.crm_playbook,
  public.crm_incidents,
  public.crm_followup_settings,
  public.crm_company_requests
TO authenticated;

GRANT ALL ON TABLE
  public.time_entries,
  public.absence_requests,
  public.festivos,
  public.admin_documents,
  public.expenses,
  public.crm_leads,
  public.crm_activities,
  public.crm_playbook,
  public.crm_incidents,
  public.crm_followup_settings,
  public.crm_company_requests
TO service_role;
