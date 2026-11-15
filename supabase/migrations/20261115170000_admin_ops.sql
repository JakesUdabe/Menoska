-- =============================================================================
-- Admin ops: Clientes (CRM), Finanzas, Calendario, Documentos, Empleados
--
-- Idempotente. Pensado para pegarlo en otro proyecto Supabase.
--
-- Requisito: public.profiles con
--   user_id uuid  (único, referencia a auth.users)
--   role    text  (valores usados aquí: 'admin' | 'empleado' | 'cliente')
-- Si el rol por defecto del proyecto no se llama 'cliente', cambia la
-- función demote_employee_to_cliente.
--
-- No crea créditos, resoluciones, catálogo de empresas ni AI SDR.
-- Esas pestañas de Clientes siguen en el frontend y hay que adaptarlas
-- o quitarlas. Ver PROMPT-MAESTRO.md.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Perfil mínimo (no pisa una tabla profiles que ya exista)
-- -----------------------------------------------------------------------------
-- public.profiles ya existe: id uuid PK -> auth.users. No se crea otra tabla.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'client',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS employee_permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS work_email text,
  ADD COLUMN IF NOT EXISTS calendly_url text;

COMMENT ON COLUMN public.profiles.employee_permissions IS
  'Permisos del rol empleado. Keys: crm, finanzas, calendario, documentos.';
COMMENT ON COLUMN public.profiles.job_title IS 'Puesto en la ficha comercial.';
COMMENT ON COLUMN public.profiles.work_email IS 'Email de trabajo. Si es null se usa el de auth.';
COMMENT ON COLUMN public.profiles.calendly_url IS 'URL https de Cal.com o Calendly.';

-- El rol de usuario normal de este producto es client. empleado entra en el check.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'profiles'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'client', 'empleado'));

UPDATE public.profiles
SET full_name = nullif(trim(concat_ws(' ', first_name, last_name)), '')
WHERE coalesce(btrim(full_name), '') = '';


-- -----------------------------------------------------------------------------
-- Helpers de acceso
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
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
    WHERE id = auth.uid()
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
    WHERE id = auth.uid()
      AND role = 'empleado'
      AND coalesce((employee_permissions ->> p_key)::boolean, false) = true
  );
$$;

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

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff_member() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_employee_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_admin_module_access(text) TO authenticated;

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

ALTER TYPE public.expense_category ADD VALUE IF NOT EXISTS 'interest';
ALTER TYPE public.expense_category ADD VALUE IF NOT EXISTS 'tax';
ALTER TYPE public.expense_category ADD VALUE IF NOT EXISTS 'depreciation';
ALTER TYPE public.expense_category ADD VALUE IF NOT EXISTS 'amortization';

DO $$ BEGIN
  CREATE TYPE public.lead_phase AS ENUM (
    'nuevo', 'contactado', 'propuesta', 'negociacion', 'convertido', 'perdido'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.incident_priority AS ENUM ('baja', 'media', 'alta', 'critica');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.incident_status AS ENUM ('abierta', 'en_progreso', 'resuelta', 'cerrada');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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
-- Finanzas
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expenses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  amount       numeric(12, 2) NOT NULL CHECK (amount >= 0),
  category     public.expense_category NOT NULL,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  description  text,
  created_by   uuid REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  external_id  text,
  billing_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_date date,
  provider     text NOT NULL DEFAULT 'manual'
);

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS billing_date date DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS payment_date date,
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'manual';

UPDATE public.expenses SET billing_date = expense_date WHERE billing_date IS NULL;
ALTER TABLE public.expenses ALTER COLUMN billing_date SET NOT NULL;

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_provider_check;
ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_provider_check
  CHECK (provider IN ('manual', 'openai', 'hetzner', 'cloudflare'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'expenses_external_id_key'
  ) THEN
    ALTER TABLE public.expenses
      ADD CONSTRAINT expenses_external_id_key UNIQUE (external_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS expenses_provider_idx ON public.expenses (provider);
CREATE INDEX IF NOT EXISTS expenses_billing_date_idx ON public.expenses (billing_date DESC);

-- -----------------------------------------------------------------------------
-- Clientes (CRM)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_leads (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre           text NOT NULL,
  apellido         text NOT NULL DEFAULT '',
  email            text NOT NULL DEFAULT '',
  empresa          text NOT NULL DEFAULT '',
  comercial_id     uuid REFERENCES auth.users(id),
  fase             public.lead_phase NOT NULL DEFAULT 'nuevo',
  ultimo_contacto  date,
  proximo_contacto date,
  comentarios      text,
  is_converted     boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS web text,
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS cargo text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS tipo_cuenta text NOT NULL DEFAULT 'empresa',
  ADD COLUMN IF NOT EXISTS prioridad text NOT NULL DEFAULT 'C',
  ADD COLUMN IF NOT EXISTS gancho text,
  ADD COLUMN IF NOT EXISTS plan_objetivo text NOT NULL DEFAULT 'profesional',
  ADD COLUMN IF NOT EXISTS fuente text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS email_copy text,
  ADD COLUMN IF NOT EXISTS linkedin_copy text,
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quality_flag text NOT NULL DEFAULT 'ok',
  ADD COLUMN IF NOT EXISTS contact_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cif text;

ALTER TABLE public.crm_leads DROP CONSTRAINT IF EXISTS crm_leads_tipo_cuenta_chk;
ALTER TABLE public.crm_leads
  ADD CONSTRAINT crm_leads_tipo_cuenta_chk
  CHECK (tipo_cuenta IN ('consultora', 'empresa', 'organismo', 'otro'));

ALTER TABLE public.crm_leads DROP CONSTRAINT IF EXISTS crm_leads_prioridad_chk;
ALTER TABLE public.crm_leads
  ADD CONSTRAINT crm_leads_prioridad_chk
  CHECK (prioridad IN ('A', 'B', 'C'));

ALTER TABLE public.crm_leads DROP CONSTRAINT IF EXISTS crm_leads_plan_objetivo_chk;
ALTER TABLE public.crm_leads
  ADD CONSTRAINT crm_leads_plan_objetivo_chk
  CHECK (plan_objetivo IN ('business', 'profesional', 'free'));

ALTER TABLE public.crm_leads DROP CONSTRAINT IF EXISTS crm_leads_fuente_chk;
ALTER TABLE public.crm_leads
  ADD CONSTRAINT crm_leads_fuente_chk
  CHECK (fuente IN (
    'outbound_consultoras', 'import_2026_07', 'inbound', 'manual',
    'referral', 'resoluciones_prospeccion', 'ai_sdr'
  ));

ALTER TABLE public.crm_leads DROP CONSTRAINT IF EXISTS crm_leads_quality_flag_chk;
ALTER TABLE public.crm_leads
  ADD CONSTRAINT crm_leads_quality_flag_chk
  CHECK (quality_flag IN ('ok', 'needs_review', 'junk', 'pendiente_correo'));

ALTER TABLE public.crm_leads DROP CONSTRAINT IF EXISTS crm_leads_contact_count_chk;
ALTER TABLE public.crm_leads
  ADD CONSTRAINT crm_leads_contact_count_chk
  CHECK (contact_count >= 0 AND contact_count <= 50);

CREATE INDEX IF NOT EXISTS crm_leads_pipeline_idx
  ON public.crm_leads (archived, prioridad, fase, proximo_contacto);
CREATE INDEX IF NOT EXISTS crm_leads_comercial_id_idx
  ON public.crm_leads (comercial_id);
CREATE INDEX IF NOT EXISTS crm_leads_empresa_idx
  ON public.crm_leads (lower(empresa));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.crm_leads
    WHERE length(trim(email)) > 0
    GROUP BY lower(email)
    HAVING count(*) > 1
  ) THEN
    WITH ranked AS (
      SELECT id,
             row_number() OVER (PARTITION BY lower(email) ORDER BY created_at, id) AS n
      FROM public.crm_leads
      WHERE length(trim(email)) > 0
    )
    UPDATE public.crm_leads AS lead
    SET email = ''
    FROM ranked
    WHERE lead.id = ranked.id
      AND ranked.n > 1;
    RAISE NOTICE 'crm_leads: emails duplicados vaciados; se crea crm_leads_email_lower_uidx';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'crm_leads_email_lower_uidx'
  ) THEN
    CREATE UNIQUE INDEX crm_leads_email_lower_uidx
      ON public.crm_leads (lower(email))
      WHERE length(trim(email)) > 0;
  END IF;
END $$;

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

CREATE TABLE IF NOT EXISTS public.crm_activities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  tipo          text NOT NULL CHECK (tipo IN (
                  'nota', 'email', 'linkedin', 'llamada', 'demo', 'seguimiento', 'post_demo'
                )),
  contenido     text NOT NULL DEFAULT '',
  scheduled_for date,
  completed_at  timestamptz,
  created_by    uuid REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_activities_lead_idx
  ON public.crm_activities (lead_id, scheduled_for);
CREATE INDEX IF NOT EXISTS crm_activities_open_idx
  ON public.crm_activities (scheduled_for)
  WHERE completed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.crm_playbook (
  key        text PRIMARY KEY,
  title      text NOT NULL,
  body       text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_followup_settings (
  id            smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  followup_days integer[] NOT NULL DEFAULT ARRAY[3, 7, 14],
  updated_at    timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.crm_followup_settings (id, followup_days)
VALUES (1, ARRAY[3, 7, 14])
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Documentos
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

-- -----------------------------------------------------------------------------
-- updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'time_entries', 'absence_requests', 'expenses',
    'crm_leads', 'crm_incidents', 'admin_documents', 'crm_playbook'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      tbl, tbl
    );
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absence_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_playbook ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_followup_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_documents ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "CRM staff view incidents" ON public.crm_incidents;
CREATE POLICY "CRM staff view incidents"
  ON public.crm_incidents FOR SELECT TO authenticated
  USING (public.has_admin_module_access('crm'));

DROP POLICY IF EXISTS "CRM staff manage incidents" ON public.crm_incidents;
CREATE POLICY "CRM staff manage incidents"
  ON public.crm_incidents FOR ALL TO authenticated
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

DROP POLICY IF EXISTS "CRM staff read followup settings" ON public.crm_followup_settings;
CREATE POLICY "CRM staff read followup settings"
  ON public.crm_followup_settings FOR SELECT TO authenticated
  USING (public.has_admin_module_access('crm'));

DROP POLICY IF EXISTS "CRM staff manage followup settings" ON public.crm_followup_settings;
CREATE POLICY "CRM staff manage followup settings"
  ON public.crm_followup_settings FOR ALL TO authenticated
  USING (public.has_admin_module_access('crm'))
  WITH CHECK (public.has_admin_module_access('crm'));

DROP POLICY IF EXISTS "Staff view documents" ON public.admin_documents;
CREATE POLICY "Staff view documents"
  ON public.admin_documents FOR SELECT TO authenticated
  USING (public.has_admin_module_access('documentos'));

DROP POLICY IF EXISTS "Staff manage documents" ON public.admin_documents;
CREATE POLICY "Staff manage documents"
  ON public.admin_documents FOR ALL TO authenticated
  USING (public.has_admin_module_access('documentos'))
  WITH CHECK (public.has_admin_module_access('documentos'));

-- Aditiva: no borra las políticas de profiles que ya tenga el proyecto.
-- El staff ve fichas de admin/empleado. Los clientes se leen vía RPC.
DROP POLICY IF EXISTS "Staff can view staff profiles" ON public.profiles;
CREATE POLICY "Staff can view staff profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR (
      public.is_staff_member()
      AND role IN ('admin', 'empleado')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.time_entries,
  public.absence_requests,
  public.festivos,
  public.expenses,
  public.crm_leads,
  public.crm_incidents,
  public.crm_activities,
  public.crm_playbook,
  public.crm_followup_settings,
  public.admin_documents
TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Seguimientos CRM
-- -----------------------------------------------------------------------------
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
-- Empleados
-- Las keys tienen que coincidir con EMPLOYEE_ASSIGNABLE_PERMISSIONS en rbac.ts.
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
    p.id,
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
  LEFT JOIN auth.users u ON u.id = p.id
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
    p.id,
    p.full_name,
    p.company_name,
    coalesce(u.email, '')::text AS email,
    p.role
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE coalesce(p.role, 'client') NOT IN ('admin', 'empleado')
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
    p.id,
    p.full_name,
    p.company_name,
    coalesce(u.email, '')::text AS email
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE coalesce(p.role, 'client') NOT IN ('admin', 'empleado')
    AND (
      v_q = ''
      OR lower(coalesce(p.full_name, '')) LIKE '%' || v_q || '%'
      OR lower(coalesce(p.company_name, '')) LIKE '%' || v_q || '%'
      OR lower(coalesce(u.email, '')) LIKE '%' || v_q || '%'
      OR lower(p.id::text) LIKE '%' || v_q || '%'
    )
  ORDER BY
    CASE WHEN coalesce(p.full_name, '') = '' THEN 1 ELSE 0 END,
    p.full_name ASC NULLS LAST,
    u.email ASC NULLS LAST
  LIMIT greatest(1, least(coalesce(p_limit, 12), 50));
END;
$$;

CREATE OR REPLACE FUNCTION public._employee_permissions_json(p_permissions jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT jsonb_build_object(
    'crm', coalesce((p_permissions ->> 'crm')::boolean, false),
    'finanzas', coalesce((p_permissions ->> 'finanzas')::boolean, false),
    'calendario', coalesce((p_permissions ->> 'calendario')::boolean, false),
    'documentos', coalesce((p_permissions ->> 'documentos')::boolean, false)
  );
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

  SELECT role INTO v_role FROM public.profiles WHERE id = p_user_id;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Perfil no encontrado';
  END IF;

  IF v_role = 'admin' THEN
    RAISE EXCEPTION 'No se puede convertir un admin en empleado';
  END IF;

  UPDATE public.profiles
  SET
    role = 'empleado',
    employee_permissions = public._employee_permissions_json(p_permissions),
    updated_at = now()
  WHERE id = p_user_id;
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

  SELECT role INTO v_role FROM public.profiles WHERE id = p_user_id;
  IF v_role IS DISTINCT FROM 'empleado' THEN
    RAISE EXCEPTION 'El usuario no es empleado';
  END IF;

  UPDATE public.profiles
  SET
    employee_permissions = public._employee_permissions_json(p_permissions),
    updated_at = now()
  WHERE id = p_user_id;
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
  WHERE id = p_user_id
    AND role IN ('empleado', 'admin');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empleado no encontrado';
  END IF;
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

  SELECT role INTO v_role FROM public.profiles WHERE id = p_user_id;
  IF v_role IS DISTINCT FROM 'empleado' THEN
    RAISE EXCEPTION 'El usuario no es empleado';
  END IF;

  UPDATE public.profiles
  SET
    role = 'client',
    employee_permissions = '{}'::jsonb,
    updated_at = now()
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.list_employee_profiles() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_users_for_employee(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_cliente_profiles(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_user_as_employee(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_employee_permissions(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_employee_commercial_identity(uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.demote_employee_to_cliente(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._employee_permissions_json(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.list_employee_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_users_for_employee(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_cliente_profiles(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_as_employee(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_employee_permissions(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_employee_commercial_identity(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.demote_employee_to_cliente(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM anon;
REVOKE ALL ON FUNCTION public.is_staff_member() FROM anon;
REVOKE ALL ON FUNCTION public.has_employee_permission(text) FROM anon;
REVOKE ALL ON FUNCTION public.has_admin_module_access(text) FROM anon;
REVOKE ALL ON FUNCTION public.list_employee_profiles() FROM anon;
REVOKE ALL ON FUNCTION public.search_users_for_employee(text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.search_cliente_profiles(text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.set_user_as_employee(uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.update_employee_permissions(uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.update_employee_commercial_identity(uuid, text, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.demote_employee_to_cliente(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.crm_next_contact_date(date, integer, integer[]) FROM anon;
REVOKE ALL ON FUNCTION public.crm_schedule_followups(uuid, date) FROM anon;

ALTER FUNCTION public._employee_permissions_json(jsonb) SET search_path = public;

