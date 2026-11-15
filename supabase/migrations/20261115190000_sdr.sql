-- AI SDR: campaigns, leads, conversations, metrics, CRM link.

-- AI SDR autónomo (outreach B2B Europa) — campañas, leads y conversaciones.
-- Complementa sales_* (HITL) con un flujo autónomo vía Apollo + Smartlead/Instantly.
-- RLS: public.has_admin_module_access('crm') ya existe en Proposalyze.

-- ---------------------------------------------------------------------------
-- sdr_campaigns
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sdr_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  target_roles text[] NOT NULL DEFAULT '{}'::text[],
  target_countries text[] NOT NULL DEFAULT '{}'::text[],
  target_industries text[] NOT NULL DEFAULT '{}'::text[],
  target_company_sizes text[] NOT NULL DEFAULT '{}'::text[],
  agent_language text NOT NULL DEFAULT 'es'
    CONSTRAINT sdr_campaigns_agent_language_check
    CHECK (agent_language IN ('es', 'en', 'de', 'fr', 'it')),
  agent_prompt text NOT NULL DEFAULT '',
  calendly_url text,
  outreach_provider text NOT NULL DEFAULT 'smartlead'
    CONSTRAINT sdr_campaigns_outreach_provider_check
    CHECK (outreach_provider IN ('smartlead', 'instantly')),
  outreach_campaign_id text,
  status text NOT NULL DEFAULT 'draft'
    CONSTRAINT sdr_campaigns_status_check
    CHECK (status IN ('draft', 'enriching', 'ready', 'running', 'paused', 'completed')),
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sdr_campaigns_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS sdr_campaigns_status_idx ON public.sdr_campaigns (status);
CREATE INDEX IF NOT EXISTS sdr_campaigns_created_at_idx ON public.sdr_campaigns (created_at DESC);

-- ---------------------------------------------------------------------------
-- sdr_leads
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sdr_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.sdr_campaigns(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  email text,
  company text,
  role text,
  country text,
  language text NOT NULL DEFAULT 'es',
  industry text,
  company_size text,
  linkedin_url text,
  apollo_id text,
  status text NOT NULL DEFAULT 'discovered'
    CONSTRAINT sdr_leads_status_check
    CHECK (status IN (
      'discovered',
      'contacted',
      'replied',
      'demo_requested',
      'demo_scheduled',
      'unsubscribed',
      'bounced'
    )),
  consent_status text NOT NULL DEFAULT 'legitimate_interest_b2b'
    CONSTRAINT sdr_leads_consent_status_check
    CHECK (consent_status IN (
      'legitimate_interest_b2b',
      'opted_in',
      'unsubscribed',
      'suppressed'
    )),
  unsubscribed_at timestamptz,
  outreach_lead_id text,
  last_contacted_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sdr_leads_campaign_id_idx ON public.sdr_leads (campaign_id);
CREATE INDEX IF NOT EXISTS sdr_leads_status_idx ON public.sdr_leads (campaign_id, status);
CREATE INDEX IF NOT EXISTS sdr_leads_email_idx ON public.sdr_leads (lower(trim(email)))
  WHERE email IS NOT NULL AND length(trim(email)) > 0;
CREATE UNIQUE INDEX IF NOT EXISTS sdr_leads_campaign_email_uidx
  ON public.sdr_leads (campaign_id, lower(trim(email)))
  WHERE email IS NOT NULL AND length(trim(email)) > 0;
CREATE INDEX IF NOT EXISTS sdr_leads_apollo_id_idx ON public.sdr_leads (apollo_id)
  WHERE apollo_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- sdr_conversations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sdr_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.sdr_leads(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.sdr_campaigns(id) ON DELETE CASCADE,
  sender text NOT NULL
    CONSTRAINT sdr_conversations_sender_check
    CHECK (sender IN ('agent', 'prospect')),
  message_body text NOT NULL DEFAULT '',
  subject text,
  intent text,
  sentiment text,
  external_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sdr_conversations_body_not_blank CHECK (length(trim(message_body)) > 0)
);

CREATE INDEX IF NOT EXISTS sdr_conversations_lead_id_idx
  ON public.sdr_conversations (lead_id, created_at ASC);
CREATE INDEX IF NOT EXISTS sdr_conversations_campaign_id_idx
  ON public.sdr_conversations (campaign_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- updated_at helper (trigger only — not callable from the Data API)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sdr_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sdr_touch_updated_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sdr_campaigns_touch_updated_at ON public.sdr_campaigns;
CREATE TRIGGER sdr_campaigns_touch_updated_at
  BEFORE UPDATE ON public.sdr_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.sdr_touch_updated_at();

DROP TRIGGER IF EXISTS sdr_leads_touch_updated_at ON public.sdr_leads;
CREATE TRIGGER sdr_leads_touch_updated_at
  BEFORE UPDATE ON public.sdr_leads
  FOR EACH ROW EXECUTE FUNCTION public.sdr_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Metrics helper (CRM staff). SECURITY DEFINER so it can aggregate regardless
-- of row visibility quirks, but it re-checks CRM access before returning data.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sdr_campaign_metrics(p_campaign_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  IF NOT public.has_admin_module_access('crm') THEN
    RAISE EXCEPTION 'Sin permisos';
  END IF;

  SELECT jsonb_build_object(
    'leads_processed', count(*) FILTER (WHERE true),
    'emails_sent', count(*) FILTER (WHERE l.status IN (
      'contacted', 'replied', 'demo_requested', 'demo_scheduled'
    )),
    'replies', count(*) FILTER (WHERE l.status IN (
      'replied', 'demo_requested', 'demo_scheduled'
    )),
    'demos_scheduled', count(*) FILTER (WHERE l.status IN (
      'demo_requested', 'demo_scheduled'
    )),
    'unsubscribed', count(*) FILTER (WHERE l.status = 'unsubscribed'),
    'conversion_rate', CASE
      WHEN count(*) FILTER (WHERE l.status IN (
        'contacted', 'replied', 'demo_requested', 'demo_scheduled', 'unsubscribed', 'bounced'
      )) = 0 THEN 0
      ELSE round(
        (
          count(*) FILTER (WHERE l.status IN ('demo_requested', 'demo_scheduled'))::numeric
          / nullif(count(*) FILTER (WHERE l.status IN (
            'contacted', 'replied', 'demo_requested', 'demo_scheduled', 'unsubscribed', 'bounced'
          )), 0)
        ) * 100,
        1
      )
    END
  )
  INTO v_result
  FROM public.sdr_leads l
  WHERE p_campaign_id IS NULL OR l.campaign_id = p_campaign_id;

  RETURN coalesce(v_result, jsonb_build_object(
    'leads_processed', 0,
    'emails_sent', 0,
    'replies', 0,
    'demos_scheduled', 0,
    'unsubscribed', 0,
    'conversion_rate', 0
  ));
END;
$$;

REVOKE ALL ON FUNCTION public.sdr_campaign_metrics(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sdr_campaign_metrics(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sdr_campaign_metrics(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.sdr_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdr_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdr_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "CRM staff sdr campaigns" ON public.sdr_campaigns;
CREATE POLICY "CRM staff sdr campaigns" ON public.sdr_campaigns FOR ALL TO authenticated
  USING ((SELECT public.has_admin_module_access('crm')))
  WITH CHECK ((SELECT public.has_admin_module_access('crm')));

DROP POLICY IF EXISTS "CRM staff sdr leads" ON public.sdr_leads;
CREATE POLICY "CRM staff sdr leads" ON public.sdr_leads FOR ALL TO authenticated
  USING ((SELECT public.has_admin_module_access('crm')))
  WITH CHECK ((SELECT public.has_admin_module_access('crm')));

DROP POLICY IF EXISTS "CRM staff sdr conversations" ON public.sdr_conversations;
CREATE POLICY "CRM staff sdr conversations" ON public.sdr_conversations FOR ALL TO authenticated
  USING ((SELECT public.has_admin_module_access('crm')))
  WITH CHECK ((SELECT public.has_admin_module_access('crm')));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sdr_campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sdr_leads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sdr_conversations TO authenticated;
GRANT ALL ON public.sdr_campaigns TO service_role;
GRANT ALL ON public.sdr_leads TO service_role;
GRANT ALL ON public.sdr_conversations TO service_role;

REVOKE ALL ON public.sdr_campaigns FROM anon;
REVOKE ALL ON public.sdr_leads FROM anon;
REVOKE ALL ON public.sdr_conversations FROM anon;


-- AI SDR: cadencia/horario/excludes en settings y estado lost en leads.
-- Las tablas sdr_* ya existen (20261101160507). Este delta no recrea el esquema.

ALTER TABLE public.sdr_campaigns
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.sdr_campaigns.settings IS
  'Cadencia outreach, horario Smartlead, exclude_domains y reglas lost. Ver SdrCampaignSettings.';

ALTER TABLE public.sdr_leads DROP CONSTRAINT IF EXISTS sdr_leads_status_check;
ALTER TABLE public.sdr_leads
  ADD CONSTRAINT sdr_leads_status_check
  CHECK (status IN (
    'discovered',
    'contacted',
    'replied',
    'demo_requested',
    'demo_scheduled',
    'unsubscribed',
    'bounced',
    'lost'
  ));

CREATE OR REPLACE FUNCTION public.sdr_campaign_metrics(p_campaign_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  IF NOT public.has_admin_module_access('crm') THEN
    RAISE EXCEPTION 'Sin permisos';
  END IF;

  SELECT jsonb_build_object(
    'leads_processed', count(*) FILTER (WHERE true),
    'emails_sent', count(*) FILTER (WHERE l.status IN (
      'contacted', 'replied', 'demo_requested', 'demo_scheduled', 'lost'
    )),
    'replies', count(*) FILTER (WHERE l.status IN (
      'replied', 'demo_requested', 'demo_scheduled'
    )),
    'demos_scheduled', count(*) FILTER (WHERE l.status IN (
      'demo_requested', 'demo_scheduled'
    )),
    'unsubscribed', count(*) FILTER (WHERE l.status = 'unsubscribed'),
    'lost', count(*) FILTER (WHERE l.status = 'lost'),
    'conversion_rate', CASE
      WHEN count(*) FILTER (WHERE l.status IN (
        'contacted', 'replied', 'demo_requested', 'demo_scheduled', 'unsubscribed', 'bounced', 'lost'
      )) = 0 THEN 0
      ELSE round(
        (
          count(*) FILTER (WHERE l.status IN ('demo_requested', 'demo_scheduled'))::numeric
          / nullif(count(*) FILTER (WHERE l.status IN (
            'contacted', 'replied', 'demo_requested', 'demo_scheduled', 'unsubscribed', 'bounced', 'lost'
          )), 0)
        ) * 100,
        1
      )
    END
  )
  INTO v_result
  FROM public.sdr_leads l
  WHERE p_campaign_id IS NULL OR l.campaign_id = p_campaign_id;

  RETURN coalesce(v_result, jsonb_build_object(
    'leads_processed', 0,
    'emails_sent', 0,
    'replies', 0,
    'demos_scheduled', 0,
    'unsubscribed', 0,
    'lost', 0,
    'conversion_rate', 0
  ));
END;
$$;

REVOKE ALL ON FUNCTION public.sdr_campaign_metrics(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sdr_campaign_metrics(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sdr_campaign_metrics(uuid) TO service_role;


-- Importado a Smartlead sin email enviado. contacted queda reservado a envío real.
ALTER TABLE public.sdr_leads DROP CONSTRAINT IF EXISTS sdr_leads_status_check;

ALTER TABLE public.sdr_leads
  ADD CONSTRAINT sdr_leads_status_check
  CHECK (status IN (
    'discovered',
    'queued',
    'contacted',
    'replied',
    'demo_requested',
    'demo_scheduled',
    'unsubscribed',
    'bounced',
    'lost'
  ));


-- Apollo discoveries land in crm_leads (fuente ai_sdr) and stay out of the
-- pipeline until Smartlead sends the first email (fase contactado).

ALTER TABLE public.sdr_leads
  ADD COLUMN IF NOT EXISTS crm_lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS sdr_leads_crm_lead_id_idx
  ON public.sdr_leads (crm_lead_id)
  WHERE crm_lead_id IS NOT NULL;

ALTER TABLE public.crm_leads DROP CONSTRAINT IF EXISTS crm_leads_fuente_chk;
ALTER TABLE public.crm_leads ADD CONSTRAINT crm_leads_fuente_chk
  CHECK (fuente = ANY (ARRAY[
    'outbound_consultoras',
    'import_2026_07',
    'inbound',
    'manual',
    'referral',
    'resoluciones_prospeccion',
    'ai_sdr'
  ]));


-- Register CRM contact after outreach send + allow intentional follow-up drafts (override person dedup).

CREATE OR REPLACE FUNCTION public.crm_register_outreach_contact(
  p_email text,
  p_from date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead public.crm_leads%ROWTYPE;
  v_days integer[];
  v_next date;
  v_count int;
  v_email text := lower(trim(coalesce(p_email, '')));
BEGIN
  IF coalesce(auth.jwt() ->> 'role', '') = 'authenticated'
     AND NOT public.has_admin_module_access('crm') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF position('@' in v_email) < 2 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_email');
  END IF;

  SELECT * INTO v_lead
  FROM public.crm_leads
  WHERE lower(trim(email)) = v_email
    AND coalesce(is_converted, false) = false
    AND fase <> 'convertido'
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  -- Same-day approve + dispatch must not double-count.
  IF v_lead.ultimo_contacto IS NOT DISTINCT FROM p_from
     AND coalesce(v_lead.contact_count, 0) > 0 THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'id', v_lead.id,
      'contact_count', v_lead.contact_count,
      'fase', v_lead.fase,
      'ultimo_contacto', v_lead.ultimo_contacto,
      'proximo_contacto', v_lead.proximo_contacto
    );
  END IF;

  v_count := coalesce(v_lead.contact_count, 0) + 1;

  SELECT followup_days INTO v_days
  FROM public.crm_followup_settings
  WHERE id = 1;

  v_next := public.crm_next_contact_date(p_from, v_count, v_days);

  UPDATE public.crm_leads
  SET
    contact_count = v_count,
    fase = CASE
      WHEN fase IN ('nuevo', 'contactado') THEN 'contactado'::public.lead_phase
      ELSE fase
    END,
    ultimo_contacto = p_from,
    proximo_contacto = v_next
  WHERE id = v_lead.id
  RETURNING * INTO v_lead;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_lead.id,
    'contact_count', v_count,
    'fase', v_lead.fase,
    'ultimo_contacto', v_lead.ultimo_contacto,
    'proximo_contacto', v_lead.proximo_contacto
  );
END;
$$;

REVOKE ALL ON FUNCTION public.crm_register_outreach_contact(text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_register_outreach_contact(text, date) TO authenticated, service_role;

COMMENT ON FUNCTION public.crm_register_outreach_contact(text, date) IS
  'Tras enviar outreach: +1 contact_count, fase contactado, ultimo/proximo según followup_days. Idempotente el mismo día.';

REVOKE ALL ON FUNCTION public.crm_register_outreach_contact(text, date) FROM anon;
