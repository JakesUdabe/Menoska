-- Paginated full company catalog for commercial request UI.

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
  ),
  enriched AS (
    SELECT
      g.ckey AS company_key,
      coalesce(g.company_name, g.domain, g.ckey) AS company_name,
      g.domain,
      g.contact_count,
      o.owner_id,
      p.full_name AS owner_name
    FROM grouped g
    LEFT JOIN top_owner o ON o.ckey = g.ckey
    LEFT JOIN public.profiles p ON p.user_id = o.owner_id
  )
  SELECT * FROM enriched
  ORDER BY company_name
  LIMIT v_limit OFFSET v_offset;
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_count_companies_catalog(p_query text DEFAULT '')
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q text := lower(trim(coalesce(p_query, '')));
  v_n bigint;
BEGIN
  IF NOT public.has_admin_module_access('crm') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT count(*)::bigint INTO v_n
  FROM (
    SELECT public.crm_lead_company_key(a.email, a.empresa, a.id) AS ckey
    FROM public.crm_leads a
    WHERE NOT a.is_converted
      AND a.fase IS DISTINCT FROM 'convertido'
      AND (
        v_q = ''
        OR lower(coalesce(a.empresa, '')) LIKE '%' || v_q || '%'
        OR lower(coalesce(a.email, '')) LIKE '%' || v_q || '%'
        OR lower(split_part(coalesce(a.email, ''), '@', 2)) LIKE '%' || v_q || '%'
      )
    GROUP BY 1
  ) s;

  RETURN coalesce(v_n, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.crm_list_companies_catalog(text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_list_companies_catalog(text, int, int) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.crm_count_companies_catalog(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_count_companies_catalog(text) TO authenticated, service_role;
