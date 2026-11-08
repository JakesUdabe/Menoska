-- Fix PL/pgSQL ambiguity: RETURNS TABLE (owner_id, company_name, ...) creates
-- variables that clash with CTE column aliases in RETURN QUERY.
-- Symptom: crm_list_companies_catalog → 400; employees see "Error cargando CRM"
-- when opening Solicitar empresas. crm_count_companies_catalog was unaffected.

CREATE OR REPLACE FUNCTION public.crm_list_companies_catalog(
  p_query text DEFAULT '',
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
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
#variable_conflict use_column
DECLARE
  v_q text := lower(trim(coalesce(p_query, '')));
  v_limit int := greatest(1, least(coalesce(p_limit, 50), 100));
  v_offset int := greatest(0, coalesce(p_offset, 0));
BEGIN
  IF NOT public.has_admin_module_access('crm') THEN
    RAISE EXCEPTION 'forbidden';
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
    WHERE v_q = ''
       OR lower(coalesce(a.empresa, '')) LIKE '%' || v_q || '%'
       OR lower(coalesce(a.email, '')) LIKE '%' || v_q || '%'
       OR lower(split_part(coalesce(a.email, ''), '@', 2)) LIKE '%' || v_q || '%'
  ),
  grouped AS (
    SELECT
      k.ckey,
      max(nullif(trim(k.empresa), '')) AS g_company_name,
      max(
        CASE
          WHEN position('@' IN lower(k.email)) > 0
            AND NOT public.crm_is_public_mail_domain(split_part(lower(k.email), '@', 2))
          THEN split_part(lower(k.email), '@', 2)
          ELSE NULL
        END
      ) AS g_domain,
      count(*)::bigint AS g_contact_count
    FROM keyed k
    GROUP BY k.ckey
  ),
  owner_rank AS (
    SELECT
      k.ckey,
      k.comercial_id AS oid,
      count(*) AS cnt,
      row_number() OVER (PARTITION BY k.ckey ORDER BY count(*) DESC) AS rn
    FROM keyed k
    WHERE k.comercial_id IS NOT NULL
    GROUP BY k.ckey, k.comercial_id
  ),
  top_owner AS (
    SELECT ckey, oid FROM owner_rank WHERE rn = 1
  )
  SELECT
    g.ckey,
    coalesce(g.g_company_name, g.g_domain, g.ckey),
    g.g_domain,
    g.g_contact_count,
    o.oid,
    p.full_name
  FROM grouped g
  LEFT JOIN top_owner o ON o.ckey = g.ckey
  LEFT JOIN public.profiles p ON p.user_id = o.oid
  ORDER BY 2
  LIMIT v_limit OFFSET v_offset;
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
#variable_conflict use_column
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
      max(nullif(trim(k.empresa), '')) AS g_company_name,
      max(
        CASE
          WHEN position('@' IN lower(k.email)) > 0
            AND NOT public.crm_is_public_mail_domain(split_part(lower(k.email), '@', 2))
          THEN split_part(lower(k.email), '@', 2)
          ELSE NULL
        END
      ) AS g_domain,
      count(*)::bigint AS g_contact_count
    FROM keyed k
    GROUP BY k.ckey
  ),
  owner_rank AS (
    SELECT
      k.ckey,
      k.comercial_id AS oid,
      count(*) AS cnt,
      row_number() OVER (PARTITION BY k.ckey ORDER BY count(*) DESC) AS rn
    FROM keyed k
    WHERE k.comercial_id IS NOT NULL
    GROUP BY k.ckey, k.comercial_id
  ),
  top_owner AS (
    SELECT ckey, oid FROM owner_rank WHERE rn = 1
  )
  SELECT
    g.ckey,
    coalesce(g.g_company_name, g.g_domain, g.ckey),
    g.g_domain,
    g.g_contact_count,
    o.oid,
    p.full_name
  FROM grouped g
  LEFT JOIN top_owner o ON o.ckey = g.ckey
  LEFT JOIN public.profiles p ON p.user_id = o.oid
  ORDER BY g.g_contact_count DESC, coalesce(g.g_company_name, g.g_domain)
  LIMIT 40;
END;
$$;
