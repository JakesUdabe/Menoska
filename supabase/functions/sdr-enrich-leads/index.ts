/**
 * POST /functions/v1/sdr-enrich-leads
 * Busca decisores B2B en Apollo.io y los guarda en sdr_leads.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  apolloSearchPeople,
  corsHeaders,
  domainFromEmail,
  enrichLeadLocalesWithLlm,
  json,
  linkDiscoveredLeadToCrm,
  loadCampaign,
  normalizeDomain,
  normalizeSdrSettings,
  requireCrm,
  resolveLeadLanguage,
} from "../_shared/sdr.ts";

const FREEMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "yahoo.com",
  "yahoo.es",
  "icloud.com",
]);

function addCompanyDomain(target: Set<string>, email: string | null | undefined) {
  const domain = domainFromEmail(email);
  if (!domain || FREEMAIL_DOMAINS.has(domain)) return;
  target.add(domain);
}

/** Clientes siempre. Perdidos solo si el último contacto cae dentro del plazo. */
async function addClientAndRecentLostDomains(
  // deno-lint-ignore no-explicit-any
  admin: any,
  target: Set<string>,
  lostRecontactDays: number,
) {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - lostRecontactDays);
  const cutoffDay = cutoff.toISOString().slice(0, 10);

  const { data: clients, error: clientsError } = await admin
    .from("crm_leads")
    .select("email")
    .or("is_converted.eq.true,fase.eq.convertido")
    .limit(5000);
  if (clientsError) throw new Error(clientsError.message);
  for (const row of clients ?? []) {
    addCompanyDomain(target, (row as { email?: string | null }).email);
  }

  const { data: clientProfiles, error: profilesError } = await admin
    .from("profiles")
    .select("work_email")
    .eq("role", "cliente")
    .limit(5000);
  if (profilesError) throw new Error(profilesError.message);
  for (const row of clientProfiles ?? []) {
    addCompanyDomain(target, (row as { work_email?: string | null }).work_email);
  }

  const { data: lost, error: lostError } = await admin
    .from("crm_leads")
    .select("email, ultimo_contacto")
    .eq("fase", "perdido")
    .limit(5000);
  if (lostError) throw new Error(lostError.message);
  for (const row of lost ?? []) {
    const lead = row as { email?: string | null; ultimo_contacto?: string | null };
    const last = (lead.ultimo_contacto ?? "").slice(0, 10);
    if (!last || last >= cutoffDay) addCompanyDomain(target, lead.email);
  }
}

const MAX_PER_REQUEST = 50;
const MAX_APOLLO_PAGES = 5;
const CONTACTED_ELSEWHERE = [
  "queued",
  "contacted",
  "replied",
  "demo_requested",
  "demo_scheduled",
  "unsubscribed",
  "bounced",
  "lost",
];

async function selectPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 1000;
  for (let from = 0; from < 20000; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value.split(/[,;\n]+/).map((v) => v.trim()).filter(Boolean);
  }
  return [];
}

/** Split Apollo employee ranges on ; / newlines only — commas belong inside "51,200". */
function asEmployeeRanges(value: unknown): string[] {
  const parts = Array.isArray(value)
    ? value.map((v) => String(v).trim()).filter(Boolean)
    : typeof value === "string" && value.trim()
    ? value.split(/[;\n]+/).map((v) => v.trim()).filter(Boolean)
    : [];

  const ranges: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const cur = parts[i];
    if (/^\d+,\d+$/.test(cur) || /^\d+,$/.test(cur)) {
      ranges.push(cur);
      continue;
    }
    // Repair ["51","200","201","500"] saved after an earlier comma-split bug
    if (/^\d+$/.test(cur) && i + 1 < parts.length && /^\d+$/.test(parts[i + 1])) {
      ranges.push(`${cur},${parts[i + 1]}`);
      i += 1;
    }
  }
  return ranges;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {    const auth = await requireCrm(req);
    if (!auth.ok) return auth.response;
    const admin = auth.admin;
    const ownerId = auth.userId;

    const body = await req.json().catch(() => ({}));
    const campaignId = String(body.campaign_id ?? "").trim();
    if (!campaignId) return json(400, { error: "campaign_id es obligatorio." });

    const campaign = await loadCampaign(admin, campaignId);
    const roles = asStringArray(body.roles ?? body.target_roles ?? campaign.target_roles);
    const countries = asStringArray(
      body.countries ?? body.target_countries ?? campaign.target_countries,
    );
    const industries = asStringArray(
      body.industries ?? body.target_industries ?? campaign.target_industries,
    );
    const companySizes = asEmployeeRanges(
      body.company_sizes ?? body.target_company_sizes ?? campaign.target_company_sizes,
    );
    const perPage = Math.min(
      Math.max(Number(body.limit ?? body.per_page ?? 25) || 25, 1),
      MAX_PER_REQUEST,
    );

    if (roles.length === 0) {
      return json(400, { error: "Indica al menos un rol / cargo (ej. Director de Innovación)." });
    }
    if (countries.length === 0) {
      return json(400, { error: "Indica al menos un país europeo." });
    }

    const settings = normalizeSdrSettings({
      ...campaign.settings,
      exclude_domains: body.exclude_domains ?? campaign.settings.exclude_domains,
      exclude_known_companies: body.exclude_known_companies ??
        campaign.settings.exclude_known_companies,
    });

    const manualDomains: string[] = [];
    const blockedDomains: string[] = [];
    const domainSeen = new Set<string>();
    const excludedEmails = new Set<string>();

    const takeDomain = (raw: string | null | undefined, bucket: string[]) => {
      const domain = raw ? normalizeDomain(raw) : null;
      if (!domain || FREEMAIL_DOMAINS.has(domain) || domainSeen.has(domain)) return;
      domainSeen.add(domain);
      bucket.push(domain);
    };
    const rememberEmail = (email: string | null | undefined) => {
      const normalized = (email ?? "").trim().toLowerCase();
      if (!normalized.includes("@")) return;
      excludedEmails.add(normalized);
      takeDomain(domainFromEmail(normalized), blockedDomains);
    };

    for (const raw of settings.exclude_domains) takeDomain(raw, manualDomains);
    for (const raw of asStringArray(body.exclude_domains)) takeDomain(raw, manualDomains);

    const campaignLeads = await selectPages<{ email: string | null }>((from, to) =>
      admin.from("sdr_leads").select("email").eq("campaign_id", campaignId).range(from, to)
    );
    for (const row of campaignLeads) rememberEmail(row.email);

    const contactedElsewhere = await selectPages<{ email: string | null }>((from, to) =>
      admin
        .from("sdr_leads")
        .select("email")
        .neq("campaign_id", campaignId)
        .in("status", CONTACTED_ELSEWHERE)
        .range(from, to)
    );
    for (const row of contactedElsewhere) rememberEmail(row.email);

    const pipeline = await selectPages<{ email: string | null; web: string | null }>((from, to) =>
      admin
        .from("crm_leads")
        .select("email, web")
        .in("fase", ["contactado", "propuesta", "negociacion", "convertido"])
        .range(from, to)
    );
    for (const row of pipeline) {
      rememberEmail(row.email);
      takeDomain(row.web, blockedDomains);
    }

    if (settings.exclude_known_companies) {
      const clientDomains = new Set<string>();
      await addClientAndRecentLostDomains(admin, clientDomains, settings.lost_recontact_days);
      for (const domain of clientDomains) takeDomain(domain, blockedDomains);
    }

    const excludeDomains = [...manualDomains, ...blockedDomains].slice(0, 1000);
    const blockedDomainSet = new Set([...manualDomains, ...blockedDomains]);

    await admin
      .from("sdr_campaigns")
      .update({
        status: "enriching",
        target_roles: roles,
        target_countries: countries,
        target_industries: industries,
        target_company_sizes: companySizes,
        settings,
      })
      .eq("id", campaignId);

    const people: Awaited<ReturnType<typeof apolloSearchPeople>> = [];
    const seenEmails = new Set<string>();
    for (let page = 1; page <= MAX_APOLLO_PAGES && people.length < perPage; page++) {
      const batch = await apolloSearchPeople({
        roles,
        countries,
        industries,
        companySizes,
        perPage,
        page,
        excludeDomains,
      });
      if (batch.length === 0) break;
      for (const person of batch) {
        if (people.length >= perPage) break;
        const email = (person.email ?? "").trim().toLowerCase();
        if (!email.includes("@") || excludedEmails.has(email) || seenEmails.has(email)) continue;
        const domain = domainFromEmail(email);
        if (domain && blockedDomainSet.has(domain)) continue;
        seenEmails.add(email);
        people.push({ ...person, email });
      }
      if (batch.length < perPage) break;
    }

    const withEmail = people.filter((p) => p.email && p.email.includes("@"));
    const needsLocale = withEmail.filter((p) => !p.country);
    let localeHints = new Map<string, { language: string; country: string | null }>();
    if (needsLocale.length > 0) {
      try {
        localeHints = await enrichLeadLocalesWithLlm(
          needsLocale.map((p) => ({
            key: p.apollo_id || p.email!,
            first_name: p.first_name,
            last_name: p.last_name,
            company: p.company,
            email: p.email,
            role: p.role,
            country: p.country,
          })),
          campaign.agent_language,
        );
      } catch (localeErr) {
        console.warn(
          "sdr-enrich-leads locale LLM:",
          localeErr instanceof Error ? localeErr.message : String(localeErr),
        );
      }
    }

    let inserted = 0;
    let updated = 0;
    let noEmail = 0;
    let skipped = 0;
    const saved: Array<Record<string, unknown>> = [];

    for (const person of people) {
      if (!person.email || !person.email.includes("@")) {
        noEmail += 1;
        skipped += 1;
        continue;
      }

      const hintKey = person.apollo_id || person.email;
      const hint = localeHints.get(hintKey);
      const country = person.country || hint?.country || null;
      const language = hint?.language ||
        resolveLeadLanguage({
          country,
          email: person.email,
          fallback: campaign.agent_language,
        });

      const row = {
        campaign_id: campaignId,
        first_name: person.first_name,
        last_name: person.last_name,
        email: person.email.toLowerCase(),
        company: person.company,
        role: person.role,
        country,
        language,
        industry: person.industry,
        company_size: person.company_size,
        linkedin_url: person.linkedin_url,
        apollo_id: person.apollo_id,
        status: "discovered",
        consent_status: "legitimate_interest_b2b",
        metadata: {
          source: "apollo",
          enriched_at: new Date().toISOString(),
          locale_source: hint ? "openai" : (person.country ? "apollo" : "heuristic"),
        },
      };

      const { data: existing } = await admin
        .from("sdr_leads")
        .select("id")
        .eq("campaign_id", campaignId)
        .ilike("email", person.email)
        .maybeSingle();

      if (existing?.id || excludedEmails.has(row.email)) {
        skipped += 1;
        continue;
      }

      const { data: created, error: insErr } = await admin
        .from("sdr_leads")
        .insert(row)
        .select("id, email, first_name, last_name, company, role, country, status")
        .single();
      if (insErr) {
        if (/duplicate|unique/i.test(insErr.message)) {
          skipped += 1;
          continue;
        }
        throw new Error(insErr.message);
      }
      saved.push(created);
      inserted += 1;
      try {
        await linkDiscoveredLeadToCrm(admin, {
          email: row.email,
          first_name: row.first_name,
          last_name: row.last_name,
          company: row.company,
          role: row.role,
          country: row.country,
          linkedin_url: row.linkedin_url,
        }, ownerId, String(created.id));
      } catch (err) {
        console.warn(
          "crm mirror skipped:",
          err instanceof Error ? err.message : err,
        );
      }
    }

    await admin
      .from("sdr_campaigns")
      .update({ status: saved.length > 0 ? "ready" : campaign.status === "running" ? "running" : "draft" })
      .eq("id", campaignId);

    return json(200, {
      campaign_id: campaignId,
      found: people.length,
      inserted,
      updated,
      no_email: noEmail,
      skipped,
      excluded_domains: excludeDomains.length,
      leads: saved,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("sdr-enrich-leads:", message);
    return json(500, { error: message });
  }
});
