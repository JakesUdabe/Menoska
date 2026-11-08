-- Company ownership requests + lookup/assign helpers for CRM commercials.

CREATE TABLE IF NOT EXISTS public.crm_company_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_key   text NOT NULL,
  company_name  text NOT NULL,
  requester_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  message       text,
  reviewed_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_company_requests_one_pending_uidx
  ON public.crm_company_requests (company_key, requester_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS crm_company_requests_status_idx
  ON public.crm_company_requests (status, created_at DESC);

ALTER TABLE public.crm_company_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY crm_company_requests_select ON public.crm_company_requests
  FOR SELECT TO authenticated
  USING (
    public.has_admin_module_access('crm')
    AND (
      public.is_super_admin()
      OR requester_id = auth.uid()
    )
  );

CREATE POLICY crm_company_requests_insert ON public.crm_company_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_admin_module_access('crm')
    AND requester_id = auth.uid()
    AND NOT public.is_super_admin()
    AND status = 'pending'
  );

CREATE POLICY crm_company_requests_update ON public.crm_company_requests
  FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Public-mail domains (must match crmCommercial.ts).
CREATE OR REPLACE FUNCTION public.crm_is_public_mail_domain(p_domain text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(coalesce(p_domain, ''))) IN (
    'gmail.com', 'googlemail.com', 'hotmail.com', 'outlook.com', 'live.com', 'msn.com',
    'yahoo.com', 'yahoo.es', 'icloud.com', 'me.com', 'proton.me', 'protonmail.com',
    'gmx.com', 'gmx.es', 'aol.com'
  );
$$;

CREATE OR REPLACE FUNCTION public.crm_lead_company_key(
  p_email text,
  p_empresa text,
  p_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  WITH norm AS (
    SELECT
      lower(trim(coalesce(p_email, ''))) AS email_norm,
      lower(trim(regexp_replace(coalesce(p_empresa, ''), '\s+', ' ', 'g'))) AS company_norm,
      CASE
        WHEN position('@' IN lower(trim(coalesce(p_email, '')))) > 0 THEN
          lower(trim(split_part(lower(trim(coalesce(p_email, ''))), '@', 2)))
        ELSE ''
      END AS domain
  )
  SELECT CASE
    WHEN n.domain <> '' AND NOT public.crm_is_public_mail_domain(n.domain) THEN 'd:' || n.domain
    WHEN n.company_norm <> '' THEN 'c:' || n.company_norm
    WHEN n.email_norm <> '' THEN 'e:' || n.email_norm
    ELSE 'id:' || coalesce(p_id::text, '00000000-0000-0000-0000-000000000000')
  END
  FROM norm n;
$$;

CREATE OR REPLACE FUNCTION public.crm_company_lookup(
  p_email text,
  p_empresa text
)
RETURNS TABLE (
  found boolean,
  company_key text,
  company_name text,
  owner_id uuid,
  owner_name text,
  contact_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
BEGIN
  IF NOT public.has_admin_module_access('crm') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_key := public.crm_lead_company_key(p_email, p_empresa, NULL);

  RETURN QUERY
  WITH matched AS (
    SELECT l.*
    FROM public.crm_leads l
    WHERE public.crm_lead_company_key(l.email, l.empresa, l.id) = v_key
      AND NOT l.is_converted
      AND l.fase IS DISTINCT FROM 'convertido'
  ),
  owners AS (
    SELECT m.comercial_id AS oid, count(*) AS cnt
    FROM matched m
    WHERE m.comercial_id IS NOT NULL
    GROUP BY m.comercial_id
  ),
  top_owner AS (
    SELECT oid FROM owners ORDER BY cnt DESC NULLS LAST LIMIT 1
  )
  SELECT
    EXISTS (SELECT 1 FROM matched),
    v_key,
    coalesce(
      (SELECT m.empresa FROM matched m WHERE trim(m.empresa) <> '' ORDER BY m.created_at LIMIT 1),
      p_empresa,
      '—'
    ),
    (SELECT oid FROM top_owner),
    (SELECT p.full_name FROM public.profiles p WHERE p.user_id = (SELECT oid FROM top_owner)),
    (SELECT count(*)::bigint FROM matched);
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_search_companies_for_request(p_query text)
RETURNS TABLE (
  company_key text,
  company_name text,
  domain text,
  contact_count bigint,
  owner_id uuid,
  owner_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q text := lower(trim(coalesce(p_query, '')));
BEGIN
  IF NOT public.has_admin_module_access('crm') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF length(v_q) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH active AS (
    SELECT *
    FROM public.crm_leads l
    WHERE NOT l.is_converted
      AND l.fase IS DISTINCT FROM 'convertido'
  ),
  keyed AS (
    SELECT
      public.crm_lead_company_key(a.email, a.empresa, a.id) AS ckey,
      a.empresa,
      a.email,
      a.comercial_id
    FROM active a
    WHERE lower(coalesce(a.empresa, '')) LIKE '%' || v_q || '%'
       OR lower(coalesce(a.email, '')) LIKE '%' || v_q || '%'
       OR lower(split_part(coalesce(a.email, ''), '@', 2)) LIKE '%' || v_q || '%'
  ),
  grouped AS (
    SELECT
      k.ckey,
      max(nullif(trim(k.empresa), '')) AS company_name,
      max(
        CASE
          WHEN position('@' IN lower(k.email)) > 0
            AND NOT public.crm_is_public_mail_domain(split_part(lower(k.email), '@', 2))
          THEN split_part(lower(k.email), '@', 2)
          ELSE NULL
        END
      ) AS domain,
      count(*)::bigint AS contact_count
    FROM keyed k
    GROUP BY k.ckey
  ),
  owner_rank AS (
    SELECT
      k.ckey,
      k.comercial_id AS owner_id,
      count(*) AS cnt,
      row_number() OVER (PARTITION BY k.ckey ORDER BY count(*) DESC) AS rn
    FROM keyed k
    WHERE k.comercial_id IS NOT NULL
    GROUP BY k.ckey, k.comercial_id
  ),
  top_owner AS (
    SELECT ckey, owner_id FROM owner_rank WHERE rn = 1
  )
  SELECT
    g.ckey,
    coalesce(g.company_name, g.domain, g.ckey),
    g.domain,
    g.contact_count,
    o.owner_id,
    p.full_name
  FROM grouped g
  LEFT JOIN top_owner o ON o.ckey = g.ckey
  LEFT JOIN public.profiles p ON p.user_id = o.owner_id
  ORDER BY g.contact_count DESC, coalesce(g.company_name, g.domain)
  LIMIT 40;
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_assign_company_to_comercial(
  p_company_key text,
  p_comercial_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n integer;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_company_key IS NULL OR trim(p_company_key) = '' OR p_comercial_id IS NULL THEN
    RAISE EXCEPTION 'invalid arguments';
  END IF;

  UPDATE public.crm_leads l
  SET comercial_id = p_comercial_id
  WHERE public.crm_lead_company_key(l.email, l.empresa, l.id) = p_company_key;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_request_company(
  p_company_key text,
  p_company_name text,
  p_message text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.has_admin_module_access('crm') OR public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_company_key IS NULL OR trim(p_company_key) = '' THEN
    RAISE EXCEPTION 'company_key required';
  END IF;

  INSERT INTO public.crm_company_requests (company_key, company_name, requester_id, message)
  VALUES (trim(p_company_key), trim(coalesce(p_company_name, p_company_key)), auth.uid(), nullif(trim(p_message), ''))
  RETURNING id INTO v_id;

  RETURN v_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'request_already_pending';
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_resolve_company_request(
  p_request_id uuid,
  p_approve boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.crm_company_requests%ROWTYPE;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_row
  FROM public.crm_company_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND OR v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'request_not_pending';
  END IF;

  IF p_approve THEN
    PERFORM public.crm_assign_company_to_comercial(v_row.company_key, v_row.requester_id);
    UPDATE public.crm_company_requests
    SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
    WHERE id = p_request_id;
  ELSE
    UPDATE public.crm_company_requests
    SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
    WHERE id = p_request_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_company_lookup(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_company_lookup(text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.crm_search_companies_for_request(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_search_companies_for_request(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.crm_assign_company_to_comercial(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_assign_company_to_comercial(text, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.crm_request_company(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_request_company(text, text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.crm_resolve_company_request(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_resolve_company_request(uuid, boolean) TO authenticated, service_role;
