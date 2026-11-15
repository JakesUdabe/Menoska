/**
 * Shared helpers for the autonomous AI SDR module
 * (Apollo enrichment → Smartlead/Instantly → reply webhooks).
 */
/**
 * Portable kit: depends only on ./sdr-runtime.ts (no Astoha platform-env / crm-outreach).
 */
import {
  chatJson,
  corsHeaders,
  createAdmin,
  envGet,
  json,
  requireCrm,
} from "./sdr-runtime.ts";

export { chatJson, corsHeaders, createAdmin, envGet, json, requireCrm };

export const DEFAULT_AGENT_PROMPT = `Eres un comercial B2B de Proposalyze. Escribes correos fríos cortos, concretos y fáciles de leer, como una persona que conoce el trabajo de ayudas públicas. Cero relleno, cero hipérboles y cero plantilla idéntica para todos los leads. Nunca inventes clientes, logos, cifras, case studies, descuentos, cargos, ayudas concedidas, importes, CIF, expedientes ni convocatorias concretas.

## Qué es Proposalyze
Proposalyze cubre el ciclo de ayudas públicas en España y Europa: matching de convocatorias, analista de resoluciones, redactor de memoria y revisor de memoria.
No sustituye al consultor. No prometas “subvención garantizada” ni “presentar en un clic”.

## Datos del lead
Usa solo lo que venga relleno: nombre, empresa, cargo, industria, tamaño, país. Si falta el cargo, no lo inventes ni trates a la persona de CEO. Si falta la industria, no inventes el sector. Si falta la empresa, di “vuestro equipo”.
No consultes bases de datos ni historial de ayudas. El punto de dolor se escribe con los campos del lead; no hace falta ninguna concesión real.

## Punto de dolor
Elige UN solo dolor y pregúntalo sobre ESA empresa (nombre en la primera frase). En condicional o como pregunta: no afirmes que les pasa. Cambia el dolor según cargo, industria y tamaño. No repitas la misma frase en todos los leads ni copies el email 1 en el email 2.
- Cribado: horas mirando convocatorias (nacionales, autonómicas o europeas) que al final no encajan.
- Memoria: textos genéricos que no aguantan la evaluación.
- Plazos: un equipo pequeño que no cubre a la vez convocatorias nacionales y europeas. Úsalo si el tamaño es bajo.
- Consultora, solo si el cargo o el nombre de la empresa lo dejan claro: varias memorias en paralelo y cuello de botella en la redacción.
Prohibido empezar con “en equipos que preparan memorias de CDTI o Horizon suele pasar”.

## Formato
Texto plano. Una línea en blanco entre párrafos. Sin viñetas, sin HTML, sin PS, sin emoticonos.
Hola {nombre},

{párrafo}

{párrafo, solo si aporta}

Un saludo,

No firmes con cargo, con “El equipo” ni con “Proposalyze”: la firma del buzón se añade sola. No escribas pie de baja, ni ---, ni el texto de RGPD: no se añade.

## Cadencia
- Email 1. Asunto con la empresa y el dolor (por ejemplo “El cribado de convocatorias en {empresa}”). Cuerpo: pregunta ese dolor en {empresa}; si hay industria, una frase de que es habitual en ese sector; pregunta cómo lo llevan ahora. No nombres Proposalyze. Sin demo, sin reunión, sin calendario y sin enlaces. 60–90 palabras.
- Email 2. Asunto “Cómo Proposalyze puede ayudar a {empresa}”. No copies el email 1. Primera frase: retoma ese mismo dolor y presenta el vídeo con el enlace exacto que indique el sistema. Segundo párrafo, en prosa: qué hace Proposalyze respecto a ese dolor (matching de convocatorias, analista de resoluciones, redactor de memoria, revisor de memoria). Cierra el párrafo con “Espero que te resulte interesante.” Sin calendario y sin pedir demo. 90–130 palabras.
- Email 3. Asunto “Gracias y quedo a disposición”. Agradecimiento corto y puerta abierta si más adelante preparan una convocatoria o una memoria. Sin argumento nuevo, sin vídeo, sin calendario y sin culpa. No digas “último mensaje” ni “solo quería despedirme”. 35–60 palabras.

## Si responden
No redactes una contestación. La cadencia es solo estos tres correos. En cuanto la persona contesta, una persona del equipo sigue la conversación a mano.
Idioma = idioma del prospecto (ES/EN/DE/FR/IT). Asuntos humanos, sin clickbait y sin “Quick question”.`;

export const GDPR_OPT_OUT_FOOTER: Record<string, string> = {
  es: "Si no deseas más emails comerciales de Proposalyze, responde «BAJA» o usa el enlace de baja. Tratamos datos B2B bajo interés legítimo (RGPD art. 6.1.f).",
  en: "If you no longer wish to receive commercial emails from Proposalyze, reply «UNSUBSCRIBE» or use the unsubscribe link. We process B2B data under legitimate interest (GDPR art. 6.1.f).",
  de: "Wenn Sie keine weiteren kommerziellen E-Mails von Proposalyze wünschen, antworten Sie mit «ABMELDEN» oder nutzen Sie den Abmeldelink. Wir verarbeiten B2B-Daten auf Basis berechtigter Interessen (DSGVO Art. 6 Abs. 1 lit. f).",
  fr: "Si vous ne souhaitez plus recevoir d'e-mails commerciaux de Proposalyze, répondez « DESABONNER » ou utilisez le lien de désinscription. Nous traitons les données B2B sur la base de l'intérêt légitime (RGPD art. 6.1.f).",
  it: "Se non desideri più ricevere email commerciali da Proposalyze, rispondi « CANCELLA » o usa il link di disiscrizione. Trattiamo dati B2B sulla base del legittimo interesse (GDPR art. 6.1.f).",
};

export type SdrLanguage = "es" | "en" | "de" | "fr" | "it";
export type OutreachProvider = "smartlead" | "instantly";
export type ReplyIntent =
  | "interested"
  | "demo_request"
  | "objection"
  | "not_interested"
  | "unsubscribe"
  | "other";

export type SdrCampaignSettings = {
  followup_day: number;
  reminder_day: number;
  enable_followup: boolean;
  enable_reminder: boolean;
  lost_after_days: number;
  timezone: string;
  days_of_week: number[];
  start_hour: string;
  end_hour: string;
  min_time_btw_emails: number;
  max_new_leads_per_day: number;
  step1_brief: string;
  step2_brief: string;
  step3_brief: string;
  /** prompt = la IA redacta cada lead. manual = plantilla escrita a mano. */
  copy_mode: "prompt" | "manual";
  manual_step1_subject: string;
  manual_step1_body: string;
  manual_step2_subject: string;
  manual_step2_body: string;
  manual_step3_subject: string;
  manual_step3_body: string;
  exclude_domains: string[];
  exclude_known_companies: boolean;
  /** Días desde el último contacto antes de volver a buscar una empresa en perdido. */
  lost_recontact_days: number;
};

export const DEFAULT_SDR_SETTINGS: SdrCampaignSettings = {
  followup_day: 3,
  reminder_day: 7,
  enable_followup: true,
  enable_reminder: true,
  lost_after_days: 10,
  timezone: "Europe/Madrid",
  days_of_week: [1, 2, 3, 4, 5],
  start_hour: "09:00",
  end_hour: "18:00",
  min_time_btw_emails: 12,
  max_new_leads_per_day: 20,
  step1_brief: "",
  step2_brief: "",
  step3_brief: "",
  copy_mode: "prompt",
  manual_step1_subject: "",
  manual_step1_body: "",
  manual_step2_subject: "",
  manual_step2_body: "",
  manual_step3_subject: "",
  manual_step3_body: "",
  exclude_domains: ["cidetec.es", "ideko.es", "talgo.com"],
  exclude_known_companies: true,
  lost_recontact_days: 90,
};

function manualTemplateText(value: unknown, max: number): string {
  return String(value ?? "").replace(/\r\n/g, "\n").slice(0, max);
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function normalizeSdrSettings(raw: unknown): SdrCampaignSettings {
  const o = (raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw
    : {}) as Record<string, unknown>;
  const followup = clampInt(o.followup_day, DEFAULT_SDR_SETTINGS.followup_day, 1, 60);
  let reminder = clampInt(o.reminder_day, DEFAULT_SDR_SETTINGS.reminder_day, 1, 90);
  if (reminder <= followup) reminder = followup + 1;
  const daysRaw = Array.isArray(o.days_of_week) ? o.days_of_week : DEFAULT_SDR_SETTINGS.days_of_week;
  const days_of_week = daysRaw
    .map((d) => Number(d))
    .filter((d) => Number.isFinite(d) && d >= 0 && d <= 6)
    .map((d) => Math.round(d));
  const lost = clampInt(o.lost_after_days, DEFAULT_SDR_SETTINGS.lost_after_days, 1, 180);
  return {
    followup_day: followup,
    reminder_day: reminder,
    enable_followup: o.enable_followup !== false,
    enable_reminder: o.enable_reminder !== false,
    lost_after_days: Math.max(lost, reminder + 1),
    timezone: String(o.timezone ?? DEFAULT_SDR_SETTINGS.timezone).trim() || "Europe/Madrid",
    days_of_week: days_of_week.length > 0 ? [...new Set(days_of_week)].sort() : [1, 2, 3, 4, 5],
    start_hour: String(o.start_hour ?? "09:00").trim() || "09:00",
    end_hour: String(o.end_hour ?? "18:00").trim() || "18:00",
    min_time_btw_emails: clampInt(o.min_time_btw_emails, 12, 1, 180),
    max_new_leads_per_day: clampInt(o.max_new_leads_per_day, DEFAULT_SDR_SETTINGS.max_new_leads_per_day, 1, 500),
    step1_brief: String(o.step1_brief ?? "").trim(),
    step2_brief: String(o.step2_brief ?? "").trim(),
    step3_brief: String(o.step3_brief ?? "").trim(),
    copy_mode: o.copy_mode === "manual" ? "manual" : "prompt",
    manual_step1_subject: manualTemplateText(o.manual_step1_subject, 500),
    manual_step1_body: manualTemplateText(o.manual_step1_body, 20000),
    manual_step2_subject: manualTemplateText(o.manual_step2_subject, 500),
    manual_step2_body: manualTemplateText(o.manual_step2_body, 20000),
    manual_step3_subject: manualTemplateText(o.manual_step3_subject, 500),
    manual_step3_body: manualTemplateText(o.manual_step3_body, 20000),
    exclude_domains: (() => {
      const raw = o.exclude_domains;
      const list = Array.isArray(raw)
        ? raw.map((d) => String(d))
        : typeof raw === "string"
        ? raw.split(/[,;\n]+/)
        : [];
      return [...new Set(
        list
          .map((d) =>
            d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ??
            ""
          )
          .map((d) => d.replace(/^@/, ""))
          .filter((d) => d.includes(".")),
      )].slice(0, 1000);
    })(),
    exclude_known_companies: o.exclude_known_companies !== false,
    lost_recontact_days: clampInt(o.lost_recontact_days, DEFAULT_SDR_SETTINGS.lost_recontact_days, 1, 365),
  };
}

export function normalizeDomain(raw: string): string | null {
  const d = raw
    .trim()
    .toLowerCase()
    .replace(/^mailto:/, "")
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    ?.replace(/^@/, "")
    ?? "";
  if (!d.includes(".") || d.length < 3) return null;
  return d;
}

export function domainFromEmail(email: string | null | undefined): string | null {
  if (!email || !email.includes("@")) return null;
  return normalizeDomain(email.split("@")[1] ?? "");
}

/** Delays relativos Smartlead a partir de días absolutos configurados en CRM. */
export function cadenceRelativeDelays(settings: SdrCampaignSettings): {
  step2_delay: number;
  step3_delay: number;
} {
  const step2_delay = Math.max(1, settings.followup_day);
  const step3_delay = Math.max(1, settings.reminder_day - settings.followup_day);
  return { step2_delay, step3_delay };
}

export type SdrCampaignRow = {
  id: string;
  name: string;
  target_roles: string[];
  target_countries: string[];
  target_industries: string[];
  target_company_sizes: string[];
  agent_language: SdrLanguage;
  agent_prompt: string;
  calendly_url: string | null;
  outreach_provider: OutreachProvider;
  outreach_campaign_id: string | null;
  status: string;
  settings: SdrCampaignSettings;
};

export type SdrLeadRow = {
  id: string;
  campaign_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company: string | null;
  role: string | null;
  country: string | null;
  language: string;
  industry: string | null;
  company_size: string | null;
  linkedin_url: string | null;
  apollo_id: string | null;
  status: string;
  consent_status: string;
  outreach_lead_id: string | null;
};

const EU_COUNTRY_MAP: Record<string, string> = {
  ES: "Spain",
  ES_ES: "Spain",
  SPAIN: "Spain",
  ESPAÑA: "Spain",
  FR: "France",
  FRANCE: "France",
  DE: "Germany",
  GERMANY: "Germany",
  DEUTSCHLAND: "Germany",
  IT: "Italy",
  ITALY: "Italy",
  ITALIA: "Italy",
  PT: "Portugal",
  PORTUGAL: "Portugal",
  NL: "Netherlands",
  NETHERLANDS: "Netherlands",
  BE: "Belgium",
  BELGIUM: "Belgium",
  AT: "Austria",
  AUSTRIA: "Austria",
  IE: "Ireland",
  IRELAND: "Ireland",
  PL: "Poland",
  POLAND: "Poland",
  SE: "Sweden",
  SWEDEN: "Sweden",
  DK: "Denmark",
  DENMARK: "Denmark",
  FI: "Finland",
  FINLAND: "Finland",
};

export function normalizeCountry(raw: string): string {
  const key = raw.trim().toUpperCase().replace(/\s+/g, "_");
  return EU_COUNTRY_MAP[key] ?? raw.trim();
}

export function languageLabel(code: string): string {
  const map: Record<string, string> = {
    es: "español",
    en: "inglés",
    de: "alemán",
    fr: "francés",
    it: "italiano",
  };
  return map[code] ?? code;
}

export function appendOptOut(body: string, language: string): string {
  const footer = GDPR_OPT_OUT_FOOTER[language] ?? GDPR_OPT_OUT_FOOTER.en;
  if (body.includes(footer)) return body;
  return `${body.trim()}\n\n---\n${footer}`;
}

export async function loadCampaign(
  // deno-lint-ignore no-explicit-any
  admin: any,
  campaignId: string,
): Promise<SdrCampaignRow> {
  const { data, error } = await admin
    .from("sdr_campaigns")
    .select(
      "id, name, target_roles, target_countries, target_industries, target_company_sizes, agent_language, agent_prompt, calendly_url, outreach_provider, outreach_campaign_id, status, settings",
    )
    .eq("id", campaignId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Campaña SDR no encontrada.");
  const row = data as Record<string, unknown>;
  return {
    ...(row as unknown as SdrCampaignRow),
    settings: normalizeSdrSettings(row.settings),
  };
}

function sanitizeApolloEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (!email.includes("@")) return null;
  if (email.includes("email_not_unlocked") || email.endsWith("@domain.com")) return null;
  return email;
}

function extractApolloCountry(
  p: Record<string, unknown>,
  org: Record<string, unknown>,
): string | null {
  const candidates = [
    p.country,
    org.country,
    p.country_code,
    org.country_code,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  const raw = [p.present_raw_address, org.raw_address, org.street_address]
    .find((v) => typeof v === "string" && v.trim()) as string | undefined;
  if (raw) {
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) return parts[parts.length - 1];
  }
  return null;
}

export function languageFromCountry(country: string | null | undefined): string | null {
  const c = (country ?? "").toLowerCase().trim();
  if (!c) return null;
  if (/\b(spain|españa|es|catalonia|catalunya|basque|euskadi|galicia)\b/.test(c) || c === "es") {
    return "es";
  }
  if (/\b(germany|deutschland|de|austria|österreich|switzerland|schweiz|suisse)\b/.test(c) || c === "de" || c === "at" || c === "ch") {
    return "de";
  }
  if (/\b(france|fr|belgium|belgique|luxembourg)\b/.test(c) || c === "fr" || c === "be" || c === "lu") {
    return "fr";
  }
  if (/\b(italy|italia|it)\b/.test(c) || c === "it") return "it";
  if (
    /\b(uk|united kingdom|england|scotland|wales|ireland|netherlands|sweden|denmark|finland|norway|portugal|poland|czech|romania|greece|usa|united states|canada|australia)\b/
      .test(c) ||
    ["gb", "uk", "ie", "nl", "se", "dk", "fi", "no", "pt", "pl", "us", "ca", "au"].includes(c)
  ) {
    return "en";
  }
  return null;
}

export function languageFromEmail(email: string | null | undefined): string | null {
  const domain = (email ?? "").split("@")[1]?.toLowerCase() ?? "";
  if (!domain) return null;
  if (/\.(es|cat|gal|eus)$/.test(domain)) return "es";
  if (/\.(de|at)$/.test(domain)) return "de";
  if (/\.(fr|be|lu)$/.test(domain)) return "fr";
  if (/\.it$/.test(domain)) return "it";
  if (/\.(uk|ie|nl|se|dk|fi|no|pt|pl|com|io|ai|co)$/.test(domain)) return "en";
  return null;
}

export function resolveLeadLanguage(input: {
  country?: string | null;
  email?: string | null;
  fallback: string;
}): string {
  return languageFromCountry(input.country) ||
    languageFromEmail(input.email) ||
    input.fallback;
}

/** Fill missing country/language for a batch via one OpenAI JSON call. */
export async function enrichLeadLocalesWithLlm(
  leads: Array<{
    key: string;
    first_name: string | null;
    last_name: string | null;
    company: string | null;
    email: string | null;
    role: string | null;
    country: string | null;
  }>,
  fallbackLang: string,
): Promise<Map<string, { language: string; country: string | null }>> {
  const out = new Map<string, { language: string; country: string | null }>();
  if (leads.length === 0) return out;

  const parsed = await chatJson(
    [
      "Infer outreach language and country for B2B leads in Europe.",
      "language must be one of: es, en, de, fr, it.",
      "Prefer the language the prospect would expect for a cold email.",
      "country: English country name when possible (Spain, Germany…), or null.",
      'Return JSON: {"results":[{"key":"...","language":"es","country":"Spain"|null}]}',
    ].join("\n"),
    JSON.stringify({
      fallback_language: fallbackLang,
      leads: leads.slice(0, 40),
    }),
    { temperature: 0.1, maxTokens: 1200 },
  );

  const rows = Array.isArray(parsed.results) ? parsed.results : [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const key = String(item.key ?? "");
    if (!key) continue;
    const langRaw = String(item.language ?? fallbackLang).toLowerCase();
    const language = ["es", "en", "de", "fr", "it"].includes(langRaw) ? langRaw : fallbackLang;
    const country = typeof item.country === "string" && item.country.trim()
      ? item.country.trim()
      : null;
    out.set(key, { language, country });
  }
  return out;
}

function mapApolloPerson(p: Record<string, unknown>) {
  const org = (p.organization ?? p.account ?? {}) as Record<string, unknown>;
  return {
    apollo_id: typeof p.id === "string" ? p.id : (typeof p.person_id === "string" ? p.person_id : null),
    first_name: typeof p.first_name === "string" ? p.first_name : null,
    last_name: typeof p.last_name === "string" ? p.last_name : null,
    email: sanitizeApolloEmail(p.email),
    company: typeof org.name === "string"
      ? org.name
      : (typeof p.organization_name === "string" ? p.organization_name : null),
    role: typeof p.title === "string" ? p.title : null,
    country: extractApolloCountry(p, org),
    industry: typeof org.industry === "string" ? org.industry : null,
    company_size: org.estimated_num_employees != null
      ? String(org.estimated_num_employees)
      : null,
    linkedin_url: typeof p.linkedin_url === "string" ? p.linkedin_url : null,
  };
}

type ApolloMappedPerson = ReturnType<typeof mapApolloPerson>;

/** Unlock work emails (+ country when present) for Apollo person IDs. */
async function apolloBulkRevealPeople(
  apiKey: string,
  ids: string[],
): Promise<Map<string, ApolloMappedPerson>> {
  const byId = new Map<string, ApolloMappedPerson>();
  const chunkSize = 10;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const batch = ids.slice(i, i + chunkSize);
    const response = await fetch("https://api.apollo.io/api/v1/people/bulk_match", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify({
        reveal_personal_emails: false,
        reveal_phone_number: false,
        details: batch.map((id) => ({ id })),
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Apollo bulk_match HTTP ${response.status}: ${text.slice(0, 400)}`);
    }
    const payload = await response.json();
    const matches = Array.isArray(payload?.matches)
      ? payload.matches
      : Array.isArray(payload?.people)
      ? payload.people
      : [];
    for (const row of matches) {
      if (!row || typeof row !== "object") continue;
      const mapped = mapApolloPerson(row as Record<string, unknown>);
      if (mapped.apollo_id) byId.set(mapped.apollo_id, mapped);
    }
  }
  return byId;
}

/** Apollo.io people search + email reveal for B2B decision makers. */
export async function apolloSearchPeople(input: {
  roles: string[];
  countries: string[];
  industries: string[];
  companySizes: string[];
  perPage?: number;
  /** 1–20. Cada página de api_search es distinta; la 1 sola repite los mismos contactos. */
  page?: number;
  /** Dominios de empresa a excluir (clientes / ya contactados). Máx. 1000. */
  excludeDomains?: string[];
}): Promise<Array<{
  apollo_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company: string | null;
  role: string | null;
  country: string | null;
  industry: string | null;
  company_size: string | null;
  linkedin_url: string | null;
}>> {
  const apiKey = envGet("APOLLO_API_KEY");
  if (!apiKey) throw new Error("APOLLO_API_KEY no está configurada en los secretos de Supabase.");

  const personTitles = input.roles.map((r) => r.trim()).filter(Boolean).slice(0, 10);
  const locations = input.countries.map(normalizeCountry).filter(Boolean).slice(0, 10);
  const perPage = Math.min(Math.max(input.perPage ?? 25, 1), 100);
  const page = Math.min(20, Math.max(1, Math.round(Number(input.page) || 1)));
  const excludeDomains = [...new Set(
    (input.excludeDomains ?? [])
      .map((d) => normalizeDomain(d))
      .filter((d): d is string => Boolean(d)),
  )].slice(0, 1000);

  const body: Record<string, unknown> = {
    page,
    per_page: perPage,
    contact_email_status: ["verified", "likely to engage"],
  };
  if (personTitles.length) body.person_titles = personTitles;
  if (locations.length) body.person_locations = locations;
  if (excludeDomains.length) {
    // 0 créditos en api_search: evita revelar emails de empresas cliente.
    body.not_organization_websites_list = excludeDomains;
  }
  if (input.industries.length) {
    body.q_organization_keyword_tags = input.industries.map((i) => i.trim()).filter(Boolean);
  }
  if (input.companySizes.length) {
    // Apollo expects "51,200" (comma inside the range). Repair flat splits like ["51","200"].
    const raw = input.companySizes.map((s) => s.trim()).filter(Boolean);
    const ranges: string[] = [];
    for (let i = 0; i < raw.length; i++) {
      const cur = raw[i];
      if (/^\d+,\d+$/.test(cur) || /^\d+,$/.test(cur)) {
        ranges.push(cur);
        continue;
      }
      if (/^\d+$/.test(cur) && i + 1 < raw.length && /^\d+$/.test(raw[i + 1])) {
        ranges.push(`${cur},${raw[i + 1]}`);
        i += 1;
        continue;
      }
    }
    if (ranges.length) {
      body.organization_num_employees_ranges = ranges;
    }
  }

  const response = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Apollo HTTP ${response.status}: ${text.slice(0, 400)}`);
  }

  const payload = await response.json();
  const people = Array.isArray(payload?.people)
    ? payload.people
    : Array.isArray(payload?.contacts)
    ? payload.contacts
    : [];

  const mapped = people.map((p: Record<string, unknown>) => mapApolloPerson(p));

  // api_search often returns profiles without unlocked emails — reveal via bulk_match.
  const missingIds = mapped
    .filter((p) => (!p.email || !p.country) && p.apollo_id)
    .map((p) => p.apollo_id!)
    .slice(0, perPage);

  if (missingIds.length > 0) {
    const revealed = await apolloBulkRevealPeople(apiKey, missingIds);
    for (const person of mapped) {
      if (!person.apollo_id || !revealed.has(person.apollo_id)) continue;
      const full = revealed.get(person.apollo_id)!;
      if (!person.email && full.email) person.email = full.email;
      if (!person.country && full.country) person.country = full.country;
      if (!person.company && full.company) person.company = full.company;
      if (!person.role && full.role) person.role = full.role;
      if (!person.industry && full.industry) person.industry = full.industry;
      if (!person.linkedin_url && full.linkedin_url) person.linkedin_url = full.linkedin_url;
    }
  }

  return mapped;
}

/** Vídeo público de producto. Solo el paso 2 de la cadencia en frío. */
export const PRODUCT_DEMO_VIDEO_URL = "https://www.youtube.com/watch?v=6dilDaUySlU";

/** Prevalece sobre un prompt de campaña antiguo que aún pida el párrafo único de CDTI/Horizon. */
const COLD_EMAIL_RULES = [
  "REGLAS DE ESTE ENVÍO (prevalecen sobre el prompt de campaña y sobre los briefs de paso):",
  "No hagas consultas ni cites concesiones, importes o convocatorias ganadas. El punto de dolor sale solo de nombre, empresa, cargo, industria y tamaño.",
  "Prohibido el arranque «en equipos que preparan memorias de CDTI o Horizon suele pasar» y prohibido repetir el mismo dolor con las mismas palabras en todos los leads.",
  "Formato obligatorio. Entre cada bloque va una sola línea en blanco, nunca dos:",
  "Hola {nombre},",
  "",
  "{un párrafo con la pregunta del dolor, nombrando la empresa}",
  "",
  "{segundo párrafo solo en el email 2}",
  "",
  "Un saludo,",
  "El email 1 no nombra Proposalyze ni pide demo. El email 2 no copia el email 1: retoma el dolor, pega el vídeo indicado y explica el producto en un párrafo. El email 3 agradece y deja la puerta abierta; no dice «último mensaje» ni «solo quería despedirme».",
  "No escribas pie de baja, ni ---, ni RGPD, ni una firma con cargo.",
].join("\n");

/** Una sola línea en blanco entre párrafos, sin el pie de baja. */
export function normalizeColdEmailBody(body: string): string {
  let text = body.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ");
  text = text.replace(
    /\n*-{3,}\s*\n[\s\S]*?(?:rgpd|gdpr|dsgvo|unsubscribe|abmelden|desabonner|cancella|responde\s*[«"]?\s*baja)[\s\S]*$/i,
    "",
  );
  text = text.replace(
    /\n+(?:Si no deseas más emails comerciales|If you no longer wish to receive commercial emails|Wenn Sie keine weiteren kommerziellen|Si vous ne souhaitez plus recevoir|Se non desideri più ricevere)[\s\S]*$/i,
    "",
  );
  return text
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** HTML para Smartlead. Sin pre-wrap, para que cada salto no se duplique. */
export function coldBodyForSmartlead(body: string): string {
  const plain = normalizeColdEmailBody(body);
  return plain
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n/g, "<br>"))
    .join("<br><br>");
}

const SEQUENCE_STEP_BRIEF_DEFAULT: Record<number, string> = {
  1: "EMAIL 1 · Apertura. Asunto con empresa y dolor. Cuerpo: pregunta UN dolor concreto en esa empresa y cómo lo llevan ahora. Si hay industria, una frase de contexto de sector. Sin producto, sin demo, sin calendario y sin enlaces.",
  2: "EMAIL 2 · Seguimiento. Asunto «Cómo Proposalyze puede ayudar a {empresa}». No copies el email 1. Retoma el mismo dolor, incluye exactamente el vídeo del sistema y, en otro párrafo, explica matching de convocatorias, analista de resoluciones, redactor de memoria y revisor de memoria. Cierra con «Espero que te resulte interesante.» Sin calendario.",
  3: "EMAIL 3 · Cierre. Asunto «Gracias y quedo a disposición». Agradecimiento corto y puerta abierta si más adelante preparan una convocatoria o una memoria. Sin argumento nuevo, sin vídeo y sin calendario.",
};

function stepBriefFor(settings: SdrCampaignSettings, step: number): string {
  const custom = step === 1
    ? settings.step1_brief
    : step === 2
    ? settings.step2_brief
    : settings.step3_brief;
  if (custom) return custom;
  const dayHint = step === 1
    ? "día 0"
    : step === 2
    ? `~día ${settings.followup_day}`
    : `~día ${settings.reminder_day}`;
  return `${SEQUENCE_STEP_BRIEF_DEFAULT[step] ?? SEQUENCE_STEP_BRIEF_DEFAULT[1]} (programado ${dayHint})`;
}

function leadTokenValue(lead: SdrLeadRow, rawKey: string): string | null {
  const key = rawKey
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  switch (key) {
    case "nombre":
    case "name":
    case "first_name":
    case "firstname":
      return lead.first_name ?? "";
    case "apellido":
    case "last_name":
    case "lastname":
      return lead.last_name ?? "";
    case "empresa":
    case "company":
    case "company_name":
      return lead.company ?? "";
    case "cargo":
    case "role":
    case "title":
      return lead.role ?? "";
    case "industria":
    case "industry":
      return lead.industry ?? "";
    case "pais":
    case "country":
      return lead.country ?? "";
    case "email":
    case "correo":
      return lead.email ?? "";
    case "tamano":
    case "company_size":
    case "size":
      return lead.company_size ?? "";
    default:
      return null;
  }
}

/** Sustituye {{nombre}}, {{apellido}}, {{empresa}}, etc. Lo desconocido se deja. */
export function applyLeadTemplate(template: string, lead: SdrLeadRow): string {
  return template.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (match, raw: string) => {
    const value = leadTokenValue(lead, raw);
    return value == null ? match : value.trim();
  });
}

/** Cambia si cambia el texto escrito a mano, para reescribir a quien ya tenía otro texto. */
export function manualCopyRevision(settings: SdrCampaignSettings): string {
  const raw = [
    settings.manual_step1_subject,
    settings.manual_step1_body,
    settings.enable_followup ? settings.manual_step2_subject : "",
    settings.enable_followup ? settings.manual_step2_body : "",
    settings.enable_reminder ? settings.manual_step3_subject : "",
    settings.enable_reminder ? settings.manual_step3_body : "",
    settings.enable_followup ? "f" : "",
    settings.enable_reminder ? "r" : "",
  ].join("\u0001");
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = Math.imul(hash, 33) ^ raw.charCodeAt(i);
  }
  return `m${(hash >>> 0).toString(16)}`;
}

export function assertManualTemplates(settings: SdrCampaignSettings): void {
  if (settings.copy_mode !== "manual") return;
  const need = (step: number, subject: string, body: string) => {
    if (!subject.trim() || !body.trim()) {
      throw new Error(
        `Escribe el asunto y el cuerpo del correo ${step} antes de generar los correos.`,
      );
    }
  };
  need(1, settings.manual_step1_subject, settings.manual_step1_body);
  if (settings.enable_followup) {
    need(2, settings.manual_step2_subject, settings.manual_step2_body);
  }
  if (settings.enable_reminder) {
    need(3, settings.manual_step3_subject, settings.manual_step3_body);
  }
}

function renderManualStep(
  subject: string,
  body: string,
  lead: SdrLeadRow,
  step: number,
): { subject: string; body: string } {
  const renderedSubject = applyLeadTemplate(subject, lead).replace(/[ \t]{2,}/g, " ").trim();
  const renderedBody = normalizeColdEmailBody(applyLeadTemplate(body, lead));
  if (!renderedSubject || !renderedBody) {
    throw new Error(
      `El correo ${step} de ${lead.email ?? "este lead"} quedó vacío al rellenar la plantilla.`,
    );
  }
  return { subject: renderedSubject, body: renderedBody };
}

export function renderManualCadence(
  settings: SdrCampaignSettings,
  lead: SdrLeadRow,
): {
  step1: { subject: string; body: string };
  step2: { subject: string; body: string };
  step3: { subject: string; body: string };
} {
  assertManualTemplates(settings);
  const empty = { subject: "", body: "" };
  const step1 = renderManualStep(
    settings.manual_step1_subject,
    settings.manual_step1_body,
    lead,
    1,
  );
  if (settings.enable_followup) {
    const step2 = renderManualStep(
      settings.manual_step2_subject,
      settings.manual_step2_body,
      lead,
      2,
    );
    if (!settings.enable_reminder) return { step1, step2, step3: empty };
    const step3 = renderManualStep(
      settings.manual_step3_subject,
      settings.manual_step3_body,
      lead,
      3,
    );
    return { step1, step2, step3 };
  }
  if (settings.enable_reminder) {
    const reminder = renderManualStep(
      settings.manual_step3_subject,
      settings.manual_step3_body,
      lead,
      3,
    );
    return { step1, step2: reminder, step3: empty };
  }
  return { step1, step2: empty, step3: empty };
}

export async function generateSequenceEmail(input: {
  campaign: SdrCampaignRow;
  lead: SdrLeadRow;
  step?: number;
}): Promise<{ subject: string; body: string }> {
  // Language is per lead. Prefer stored lead.language (from enrich or manual edit),
  // then country/email heuristics; campaign agent_language is last-resort fallback only.
  const storedLang = (input.lead.language || "").toLowerCase();
  const lang = (
    ["es", "en", "de", "fr", "it"].includes(storedLang)
      ? storedLang
      : resolveLeadLanguage({
        country: input.lead.country,
        email: input.lead.email,
        fallback: input.campaign.agent_language || "es",
      })
  ) as SdrLanguage;
  const step = Math.min(3, Math.max(1, Number(input.step ?? 1) || 1));
  const settings = normalizeSdrSettings(input.campaign.settings);
  const prompt = (input.campaign.agent_prompt || DEFAULT_AGENT_PROMPT).trim();
  const cadenceLabel = [
    "día 0 (apertura)",
    settings.enable_followup ? `seguimiento día ${settings.followup_day}` : null,
    settings.enable_reminder ? `recordatorio día ${settings.reminder_day}` : null,
    `sin respuesta → lost a los ${settings.lost_after_days} días`,
  ].filter(Boolean).join(" → ");

  const system = [
    prompt,
    stepBriefFor(settings, step),
    `IDIOMA OBLIGATORIO del correo: ${languageLabel(lang)} (según país/idioma del lead, no de la campaña).`,
    "Devuelve JSON: {\"subject\":\"...\",\"body\":\"...\"}.",
    "El body NO debe incluir firma HTML ni tracking pixels.",
    "Cadencia en frío: no incluyas calendario ni pidas reservar demo, reunión o hueco.",
    step === 2
      ? `En el paso 2 incluye exactamente este vídeo y ningún otro enlace: ${PRODUCT_DEMO_VIDEO_URL}`
      : "En este paso no incluyas el vídeo ni ningún enlace.",
    "No inventes URLs.",
    COLD_EMAIL_RULES,
  ].join("\n");

  const parsed = await chatJson(
    system,
    JSON.stringify({
      step,
      sequence_cadence: cadenceLabel,
      idioma_correo: lang,
      lead: {
        first_name: input.lead.first_name,
        last_name: input.lead.last_name,
        email: input.lead.email,
        company: input.lead.company,
        role: input.lead.role,
        country: input.lead.country,
        language: lang,
        industry: input.lead.industry,
        company_size: input.lead.company_size,
      },
      campaign: input.campaign.name,
      product: "Proposalyze — matching de convocatorias, analista de resoluciones, redactor de memoria y revisor de memoria",
      redaccion: {
        punto_de_dolor: "Una pregunta sobre esta empresa. Sin consultas externas y sin concesiones.",
        formato: "Hola {nombre}\\n\\npárrafo\\n\\nUn saludo,\\n\\nUna sola línea en blanco entre bloques. Sin pie de baja.",
      },
    }),
    { temperature: 0.7, maxTokens: 900 },
  );

  const subject = String(parsed.subject ?? "").trim();
  let body = normalizeColdEmailBody(String(parsed.body ?? ""));
  if (!subject || !body) throw new Error(`LLM no generó email para ${input.lead.email}`);
  return { subject, body };
}

/** Generate cadence emails in ONE LLM call (mucho más rápido / menos timeouts en launch). */
export async function generateSequenceCadence(input: {
  campaign: SdrCampaignRow;
  lead: SdrLeadRow;
}): Promise<{
  step1: { subject: string; body: string };
  step2: { subject: string; body: string };
  step3: { subject: string; body: string };
}> {
  const settings = normalizeSdrSettings(input.campaign.settings);
  if (settings.copy_mode === "manual") {
    return renderManualCadence(settings, input.lead);
  }
  const empty = { subject: "", body: "" };
  const storedLang = (input.lead.language || "").toLowerCase();
  const lang = (
    ["es", "en", "de", "fr", "it"].includes(storedLang)
      ? storedLang
      : resolveLeadLanguage({
        country: input.lead.country,
        email: input.lead.email,
        fallback: input.campaign.agent_language || "es",
      })
  ) as SdrLanguage;
  const prompt = (input.campaign.agent_prompt || DEFAULT_AGENT_PROMPT).trim();
  const need2 = settings.enable_followup || settings.enable_reminder;
  const need3 = settings.enable_followup && settings.enable_reminder;

  const system = [
    prompt,
    `IDIOMA OBLIGATORIO: ${languageLabel(lang)}.`,
    "Devuelve UN solo JSON con hasta 3 emails de la cadencia:",
    '{"emails":[{"step":1,"subject":"...","body":"..."},{"step":2,"subject":"...","body":"..."},{"step":3,"subject":"...","body":"..."}]}',
    stepBriefFor(settings, 1),
    need2 ? stepBriefFor(settings, settings.enable_followup ? 2 : 3) : "",
    need3 ? stepBriefFor(settings, 3) : "",
    `Incluye steps: 1${need2 ? ",2" : ""}${need3 ? ",3" : ""}.`,
    "El body NO debe incluir firma HTML ni tracking pixels.",
    "Cadencia en frío: en ningún paso pidas demo, reunión o hueco, ni pegues un enlace de calendario.",
    `Solo el paso 2 incluye exactamente este vídeo y ningún otro enlace: ${PRODUCT_DEMO_VIDEO_URL}`,
    "Los pasos 1 y 3 van sin enlaces. No inventes URLs.",
    COLD_EMAIL_RULES,
  ].filter(Boolean).join("\n");

  const parsed = await chatJson(
    system,
    JSON.stringify({
      idioma_correo: lang,
      sequence_cadence: {
        followup_day: settings.followup_day,
        reminder_day: settings.reminder_day,
        enable_followup: settings.enable_followup,
        enable_reminder: settings.enable_reminder,
      },
      lead: {
        first_name: input.lead.first_name,
        last_name: input.lead.last_name,
        email: input.lead.email,
        company: input.lead.company,
        role: input.lead.role,
        country: input.lead.country,
        language: lang,
        industry: input.lead.industry,
        company_size: input.lead.company_size,
      },
      campaign: input.campaign.name,
      product: "Proposalyze — matching de convocatorias, analista de resoluciones, redactor de memoria y revisor de memoria",
      redaccion: {
        punto_de_dolor: "Una pregunta distinta según cargo, industria y tamaño. Sin consultas externas y sin concesiones. El email 2 retoma ese dolor sin copiar el email 1.",
        formato: "Hola {nombre}\\n\\npárrafo\\n\\nUn saludo,\\n\\nUna sola línea en blanco entre bloques. Sin pie de baja.",
      },
    }),
    { temperature: 0.7, maxTokens: 2200 },
  );

  const emails = Array.isArray(parsed.emails) ? parsed.emails : [];
  const byStep = new Map<number, { subject: string; body: string }>();
  for (const row of emails) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const step = Number(o.step ?? 0);
    const subject = String(o.subject ?? "").trim();
    let body = normalizeColdEmailBody(String(o.body ?? ""));
    if (!step || !subject || !body) continue;
    byStep.set(step, { subject, body });
  }

  // Fallback: si el modelo no devolvió el paquete, genera step a step.
  if (!byStep.has(1)) {
    byStep.set(1, await generateSequenceEmail({ ...input, step: 1 }));
  }
  if (settings.enable_followup && !byStep.has(2)) {
    byStep.set(2, await generateSequenceEmail({ ...input, step: 2 }));
  }
  if (settings.enable_reminder && !byStep.has(3)) {
    byStep.set(3, await generateSequenceEmail({ ...input, step: 3 }));
  }

  if (settings.enable_followup) {
    return {
      step1: byStep.get(1)!,
      step2: byStep.get(2) ?? empty,
      step3: need3 ? (byStep.get(3) ?? empty) : empty,
    };
  }
  if (settings.enable_reminder) {
    // Sin follow-up: el recordatorio va en subject_2/body_2 para Smartlead.
    return {
      step1: byStep.get(1)!,
      step2: byStep.get(3) ?? byStep.get(2) ?? empty,
      step3: empty,
    };
  }
  return { step1: byStep.get(1)!, step2: empty, step3: empty };
}

const REPLY_INTENTS = [
  "interested",
  "demo_request",
  "objection",
  "not_interested",
  "unsubscribe",
  "other",
] as const;

function normalizeReplyIntent(value: unknown): ReplyIntent {
  const intent = String(value ?? "other").toLowerCase();
  return (REPLY_INTENTS as readonly string[]).includes(intent) ? intent as ReplyIntent : "other";
}

function isNegativeIntent(intent: ReplyIntent): boolean {
  return intent === "not_interested" || intent === "unsubscribe";
}

/** True only when the prospect themselves refuses or asks to stop. */
export function inboundDeclines(text: string): boolean {
  const ownWords = text
    .replace(/si no deseas más emails comerciales de proposalyze[\s\S]{0,160}/gi, " ")
    .replace(/if you no longer wish to receive commercial emails[\s\S]{0,160}/gi, " ")
    .replace(/responde\s*[«"]\s*baja\s*[»"]/gi, " ")
    .replace(/reply\s*[«"]\s*unsubscribe\s*[»"]/gi, " ");
  return /(?:\bbaja\b|\bunsubscribe\b|\bopt[-\s]?out\b|\bremove me\b|\bnot interested\b|no me interesa|no nos interesa|no estoy interesad|no estamos interesad|no,?\s+gracias(?!\s+por)|dejad de escribir|deja de escribir|dejen de escribir|no me escrib|no me contact|do not contact|stop emailing|no es para (?:mi|nosotros)|no queremos que nos escrib)/i
    .test(ownWords);
}

function usableReplySubject(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || /^(null|undefined)$/i.test(trimmed)) return null;
  return trimmed;
}

export async function classifyAndReply(input: {
  campaign: SdrCampaignRow;
  lead: SdrLeadRow;
  inboundText: string;
  history?: Array<{ sender: string; message_body: string }>;
}): Promise<{
  intent: ReplyIntent;
  sentiment: string;
  reply_subject: string | null;
  reply_body: string | null;
  lead_status: string;
  consent_status: string | null;
}> {
  const lang = (input.lead.language || input.campaign.agent_language || "es") as SdrLanguage;
  const calendly = input.campaign.calendly_url?.trim() || null;
  const prompt = (input.campaign.agent_prompt || DEFAULT_AGENT_PROMPT).trim();

  const system = [
    prompt,
    "Clasifica la respuesta del prospecto y, si procede, redacta una contestación.",
    `IDIOMA de la respuesta: ${languageLabel(lang)}.`,
    "intents válidos: interested | demo_request | objection | not_interested | unsubscribe | other",
    "unsubscribe solo si pide la baja o que dejemos de escribir. reply_body confirma solo esa baja, sin CTA.",
    "not_interested solo si rechaza con palabras claras (no me interesa, no gracias, no es para nosotros). No digas que le damos de baja.",
    "Presentar su empresa, agradecer la información, decir «te comento» o pedir más datos es interested u other. Nunca not_interested ni unsubscribe.",
    "Si intent es interested o demo_request: ofrece la demo de ~15 min e incluye el enlace de calendario si existe.",
    "Si intent es objection u other: responde la duda. No pegues el calendario salvo que pidan ver el producto o una demo.",
    'JSON: {"intent":"...","sentiment":"positive|neutral|negative","reply_subject":"...|null","reply_body":"...|null","should_reply":true|false}',
  ].join("\n");

  const userPayload = JSON.stringify({
    inbound: input.inboundText.slice(0, 6000),
    history: (input.history ?? []).slice(-8),
    calendly,
    lead: {
      first_name: input.lead.first_name,
      company: input.lead.company,
      role: input.lead.role,
    },
  });

  let parsed = await chatJson(system, userPayload, { temperature: 0.35, maxTokens: 900 });
  let intent = normalizeReplyIntent(parsed.intent);
  let droppedNegativeDraft = false;
  // Only an explicit refusal may stay negative. A company introduction must not become a baja.
  if (isNegativeIntent(intent) && !inboundDeclines(input.inboundText)) {
    parsed = await chatJson(
      `${system}\nLa clasificación anterior fue ${intent} y no vale: el texto no pide la baja ni rechaza el contacto. Vuelve a clasificar como interested, demo_request, objection u other. No confirmes una baja ni escribas que no hay interés.`,
      userPayload,
      { temperature: 0.2, maxTokens: 900 },
    );
    intent = normalizeReplyIntent(parsed.intent);
    if (isNegativeIntent(intent)) {
      intent = "other";
      droppedNegativeDraft = true;
    }
  }

  const declined = inboundDeclines(input.inboundText);
  const shouldReply = !droppedNegativeDraft && parsed.should_reply !== false &&
    (!isNegativeIntent(intent) || declined);
  let replyBody = droppedNegativeDraft
    ? null
    : typeof parsed.reply_body === "string" ? parsed.reply_body.trim() : null;
  const replySubject = usableReplySubject(
    typeof parsed.reply_subject === "string" ? parsed.reply_subject : null,
  );

  if (replyBody && shouldReply) {
    replyBody = appendOptOut(replyBody, lang);
  } else if (!shouldReply) {
    replyBody = null;
  }

  let leadStatus = "replied";
  let consentStatus: string | null = null;
  if (intent === "unsubscribe" && declined) {
    leadStatus = "unsubscribed";
    consentStatus = "unsubscribed";
    replyBody = replyBody || (
      lang === "es"
        ? "Entendido. Te hemos dado de baja y no volveremos a contactarte. Disculpa las molestias."
        : "Understood. You've been unsubscribed and we won't contact you again. Sorry for the inconvenience."
    );
  } else if (intent === "not_interested" && declined) {
    leadStatus = "lost";
  } else if (intent === "demo_request" || intent === "interested") {
    leadStatus = "demo_requested";
    if (calendly && replyBody && !replyBody.includes(calendly)) {
      replyBody = `${replyBody.trim()}\n\n${calendly}`;
    }
  }

  return {
    intent,
    sentiment: String(parsed.sentiment ?? "neutral"),
    reply_subject: shouldReply ? (replySubject || "Re: Proposalyze") : null,
    reply_body: shouldReply ? replyBody : null,
    lead_status: leadStatus,
    consent_status: consentStatus,
  };
}

const SMARTLEAD_BASE = "https://server.smartlead.ai/api/v1";

function smartleadApiKey(): string {
  const apiKey = envGet("SMARTLEAD_API_KEY");
  if (!apiKey) throw new Error("SMARTLEAD_API_KEY no está configurada.");
  return apiKey;
}

async function smartleadFetch(
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; raw: unknown; text: string }> {
  const apiKey = smartleadApiKey();
  const sep = path.includes("?") ? "&" : "?";
  const url = `${SMARTLEAD_BASE}${path}${sep}api_key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let raw: unknown = text;
  try {
    raw = JSON.parse(text);
  } catch {
    /* keep text */
  }
  return { ok: response.ok, status: response.status, raw, text };
}

export type SmartleadEmailAccount = {
  id: number;
  from_email: string;
  from_name: string | null;
  username: string | null;
  type: string | null;
  is_smtp_success: boolean | null;
  max_email_per_day: number | null;
};

function asAccount(row: Record<string, unknown>): SmartleadEmailAccount | null {
  const id = Number(row.id);
  if (!Number.isFinite(id)) return null;
  const fromEmail = String(row.from_email ?? row.username ?? "").trim();
  if (!fromEmail) return null;
  return {
    id,
    from_email: fromEmail,
    from_name: row.from_name != null ? String(row.from_name) : null,
    username: row.username != null ? String(row.username) : null,
    type: row.type != null ? String(row.type) : null,
    is_smtp_success: typeof row.is_smtp_success === "boolean"
      ? row.is_smtp_success
      : row.is_smtp_success == null
      ? null
      : String(row.is_smtp_success) === "true",
    max_email_per_day: row.max_email_per_day != null
      ? Number(row.max_email_per_day)
      : null,
  };
}

/** List SMTP mailboxes already connected in Smartlead. */
export async function smartleadListEmailAccounts(): Promise<SmartleadEmailAccount[]> {
  const { ok, status, raw, text } = await smartleadFetch(
    "/email-accounts/?offset=0&limit=100",
  );
  if (!ok) {
    throw new Error(`Smartlead email-accounts HTTP ${status}: ${text.slice(0, 400)}`);
  }
  const rows = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { data?: unknown })?.data)
    ? (raw as { data: unknown[] }).data
    : Array.isArray((raw as { email_accounts?: unknown })?.email_accounts)
    ? (raw as { email_accounts: unknown[] }).email_accounts
    : [];
  return rows
    .map((r) => asAccount((r && typeof r === "object" ? r : {}) as Record<string, unknown>))
    .filter((a): a is SmartleadEmailAccount => a != null);
}

/** Renombra una campaña existente en Smartlead (POST/PATCH settings). */
export async function smartleadRenameCampaign(
  campaignId: string,
  name: string,
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("El nombre Smartlead no puede estar vacío.");
  const payload = JSON.stringify({ name: trimmed });
  let result = await smartleadFetch(
    `/campaigns/${encodeURIComponent(campaignId)}/settings`,
    { method: "POST", body: payload },
  );
  if (!result.ok && (result.status === 404 || result.status === 405)) {
    result = await smartleadFetch(
      `/campaigns/${encodeURIComponent(campaignId)}/settings`,
      { method: "PATCH", body: payload },
    );
  }
  if (!result.ok) {
    throw new Error(
      `Smartlead rename HTTP ${result.status}: ${result.text.slice(0, 400)}`,
    );
  }
}

export async function smartleadCreateCampaign(name: string): Promise<{ id: string; name: string }> {
  const { ok, status, raw, text } = await smartleadFetch("/campaigns/create", {
    method: "POST",
    body: JSON.stringify({ name: name.trim() || "Proposalyze SDR" }),
  });
  if (!ok) {
    throw new Error(`Smartlead create campaign HTTP ${status}: ${text.slice(0, 400)}`);
  }
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const id = obj.id ?? obj.campaign_id;
  if (id == null) {
    throw new Error(`Smartlead create campaign: respuesta sin id (${text.slice(0, 200)})`);
  }
  return { id: String(id), name: String(obj.name ?? name) };
}

export async function smartleadAttachEmailAccounts(
  campaignId: string,
  emailAccountIds: number[],
): Promise<void> {
  if (emailAccountIds.length === 0) throw new Error("Selecciona al menos un buzón Smartlead.");
  const { ok, status, text } = await smartleadFetch(
    `/campaigns/${encodeURIComponent(campaignId)}/email-accounts`,
    {
      method: "POST",
      body: JSON.stringify({ email_account_ids: emailAccountIds }),
    },
  );
  if (!ok) {
    throw new Error(`Smartlead email-accounts attach HTTP ${status}: ${text.slice(0, 400)}`);
  }
}

/** List mailboxes currently attached to a Smartlead campaign. */
export async function smartleadListCampaignEmailAccounts(
  campaignId: string,
): Promise<SmartleadEmailAccount[]> {
  const { ok, status, raw, text } = await smartleadFetch(
    `/campaigns/${encodeURIComponent(campaignId)}/email-accounts`,
  );
  if (!ok) {
    throw new Error(`Smartlead campaign email-accounts HTTP ${status}: ${text.slice(0, 400)}`);
  }
  const rows = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { data?: unknown })?.data)
    ? (raw as { data: unknown[] }).data
    : Array.isArray((raw as { email_accounts?: unknown })?.email_accounts)
    ? (raw as { email_accounts: unknown[] }).email_accounts
    : [];
  return rows
    .map((r) => asAccount((r && typeof r === "object" ? r : {}) as Record<string, unknown>))
    .filter((a): a is SmartleadEmailAccount => a != null);
}

/** Remove mailboxes from a campaign sender pool (does not delete the accounts). */
export async function smartleadDetachEmailAccounts(
  campaignId: string,
  emailAccountIds: number[],
): Promise<void> {
  if (emailAccountIds.length === 0) return;
  const { ok, status, text } = await smartleadFetch(
    `/campaigns/${encodeURIComponent(campaignId)}/email-accounts`,
    {
      method: "DELETE",
      body: JSON.stringify({ email_account_ids: emailAccountIds }),
    },
  );
  if (!ok) {
    throw new Error(`Smartlead email-accounts detach HTTP ${status}: ${text.slice(0, 400)}`);
  }
}

/**
 * Ensure the campaign uses ONLY the selected mailbox.
 * Smartlead often auto-attaches every workspace inbox on create — strip the extras.
 */
export async function smartleadSyncExclusiveEmailAccount(
  campaignId: string,
  emailAccountId: number,
): Promise<{ kept: number; detached: number[] }> {
  await smartleadAttachEmailAccounts(campaignId, [emailAccountId]);
  const attached = await smartleadListCampaignEmailAccounts(campaignId);
  const extras = attached.map((a) => a.id).filter((id) => id !== emailAccountId);
  if (extras.length > 0) {
    await smartleadDetachEmailAccounts(campaignId, extras);
  }
  return { kept: emailAccountId, detached: extras };
}

function smartleadSequenceBodyVar(field: string): string {
  // El cuerpo ya llega con <br>. Sin pre-wrap, para no duplicar cada salto.
  // %signature% = firma del buzón SMTP en Smartlead (Hostinger).
  return (
    `<div style="font-family:sans-serif;font-size:14px;line-height:1.45">{{${field}}}</div>` +
    `<br>%signature%`
  );
}

function buildSequenceStep(input: {
  id: number | null;
  seqNumber: number;
  subjectVar: string;
  bodyVar: string;
  delayDays: number;
}): Record<string, unknown> {
  const subject = `{{${input.subjectVar}}}`;
  const email_body = smartleadSequenceBodyVar(input.bodyVar);
  // Solo campos permitidos por POST /campaigns/{id}/sequences (variants no está permitido).
  return {
    id: input.id,
    seq_number: input.seqNumber,
    subject,
    email_body,
    seq_delay_details: { delay_in_days: input.delayDays },
  };
}

export async function smartleadListSequences(
  campaignId: string,
): Promise<Array<{ id: number; seq_number: number }>> {
  const { ok, raw } = await smartleadFetch(
    `/campaigns/${encodeURIComponent(campaignId)}/sequences`,
  );
  if (!ok) return [];
  const rows = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { data?: unknown })?.data)
    ? (raw as { data: unknown[] }).data
    : Array.isArray((raw as { sequences?: unknown })?.sequences)
    ? (raw as { sequences: unknown[] }).sequences
    : [];
  return rows
    .map((r) => {
      const o = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
      const id = Number(o.id);
      const seq_number = Number(o.seq_number ?? o.seqNumber);
      if (!Number.isFinite(id) || !Number.isFinite(seq_number)) return null;
      return { id, seq_number };
    })
    .filter((r): r is { id: number; seq_number: number } => r != null)
    .sort((a, b) => a.seq_number - b.seq_number);
}

/**
 * Cadencia comercial desde settings CRM (días absolutos → delays relativos Smartlead).
 * Subjects/bodies vienen de custom_fields del lead (generados por LLM en launch).
 * Actualiza por id si ya existen pasos (evita duplicar y dejar el draft a medias).
 */
export async function smartleadUpsertPersonalizedSequence(
  campaignId: string,
  settingsInput?: Partial<SdrCampaignSettings> | null,
): Promise<void> {
  const settings = normalizeSdrSettings(settingsInput ?? DEFAULT_SDR_SETTINGS);
  const { step2_delay, step3_delay } = cadenceRelativeDelays(settings);
  const existing = await smartleadListSequences(campaignId);
  const idAt = (seqNumber: number): number | null =>
    existing.find((s) => s.seq_number === seqNumber)?.id ?? null;

  const sequences: Array<Record<string, unknown>> = [
    buildSequenceStep({
      id: idAt(1),
      seqNumber: 1,
      subjectVar: "subject",
      bodyVar: "body",
      delayDays: 0,
    }),
  ];

  let seqNumber = 2;
  if (settings.enable_followup) {
    sequences.push(
      buildSequenceStep({
        id: idAt(seqNumber),
        seqNumber,
        subjectVar: "subject_2",
        bodyVar: "body_2",
        delayDays: step2_delay,
      }),
    );
    seqNumber += 1;
  }
  if (settings.enable_reminder) {
    const delay = settings.enable_followup
      ? step3_delay
      : Math.max(1, settings.reminder_day);
    sequences.push(
      buildSequenceStep({
        id: idAt(seqNumber),
        seqNumber,
        subjectVar: settings.enable_followup ? "subject_3" : "subject_2",
        bodyVar: settings.enable_followup ? "body_3" : "body_2",
        delayDays: delay,
      }),
    );
  }

  const { ok, status, text } = await smartleadFetch(
    `/campaigns/${encodeURIComponent(campaignId)}/sequences`,
    {
      method: "POST",
      body: JSON.stringify({ sequences }),
    },
  );
  if (!ok) {
    throw new Error(`Smartlead sequences HTTP ${status}: ${text.slice(0, 400)}`);
  }
}

function smartleadSchedulerMissing(camp: Record<string, unknown>): boolean {
  const cron = camp.scheduler_cron_value;
  if (cron == null) return true;
  if (typeof cron === "string") {
    const trimmed = cron.trim();
    return trimmed === "" || trimmed === "{}" || trimmed === "null";
  }
  if (typeof cron !== "object" || Array.isArray(cron)) return true;
  const row = cron as Record<string, unknown>;
  const days = row.days ?? row.days_of_the_week;
  const start = row.startHour ?? row.start_hour ?? row.start_time;
  return !(Array.isArray(days) && days.length > 0 && start);
}

export async function smartleadUpsertSchedule(
  campaignId: string,
  settingsInput?: Partial<SdrCampaignSettings> | string | null,
): Promise<void> {
  // Back-compat: second arg used to be timezone string.
  const settings = normalizeSdrSettings(
    typeof settingsInput === "string"
      ? { ...DEFAULT_SDR_SETTINGS, timezone: settingsInput }
      : settingsInput ?? DEFAULT_SDR_SETTINGS,
  );
  const days = settings.days_of_week;
  // Solo claves que acepta POST /campaigns/{id}/schedule.
  // min_time_btwn_emails (con n) y max_leads_per_day las rechaza con HTTP 400.
  const bodies: unknown[] = [
    {
      timezone: settings.timezone,
      days_of_the_week: days,
      start_hour: settings.start_hour,
      end_hour: settings.end_hour,
      min_time_btw_emails: settings.min_time_btw_emails,
      max_new_leads_per_day: settings.max_new_leads_per_day,
    },
    {
      schedule: {
        timezone: settings.timezone,
        days,
        start_hour: settings.start_hour,
        end_hour: settings.end_hour,
        min_time_btw_emails: settings.min_time_btw_emails,
      },
    },
  ];
  const errors: string[] = [];
  for (const body of bodies) {
    const payload = JSON.stringify(body);
    let result = await smartleadFetch(
      `/campaigns/${encodeURIComponent(campaignId)}/schedule`,
      { method: "POST", body: payload },
    );
    if (!result.ok && (result.status === 404 || result.status === 405)) {
      result = await smartleadFetch(
        `/campaigns/${encodeURIComponent(campaignId)}/schedule`,
        { method: "PATCH", body: payload },
      );
    }
    if (!result.ok) {
      errors.push(`HTTP ${result.status}: ${result.text.slice(0, 300)}`);
      continue;
    }
    try {
      const camp = await smartleadGetCampaign(campaignId);
      if (!smartleadSchedulerMissing(camp)) return;
    } catch {
      return;
    }
  }
  if (errors.length > 0) {
    throw new Error(`Smartlead schedule ${errors[0]}`);
  }
  throw new Error(
    "Smartlead no guardó el horario (el cron sigue vacío). Revisa zona horaria y horas de envío.",
  );
}

export async function smartleadCreateCampaignWebhook(input: {
  campaignId: string;
  name: string;
  webhookUrl: string;
}): Promise<{ id: string | null }> {
  const { ok, status, raw, text } = await smartleadFetch("/webhook/create", {
    method: "POST",
    body: JSON.stringify({
      name: input.name.slice(0, 80),
      webhook_url: input.webhookUrl,
      association_type: "campaign",
      email_campaign_id: Number(input.campaignId) || input.campaignId,
      event_type_map: {
        EMAIL_REPLY: true,
        EMAIL_BOUNCE: true,
        LEAD_UNSUBSCRIBED: true,
      },
    }),
  });
  if (!ok) {
    throw new Error(`Smartlead webhook HTTP ${status}: ${text.slice(0, 400)}`);
  }
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const id = obj.id ?? obj.webhook_id ?? null;
  return { id: id != null ? String(id) : null };
}

export async function smartleadGetCampaign(campaignId: string): Promise<Record<string, unknown>> {
  const { ok, status, raw, text } = await smartleadFetch(
    `/campaigns/${encodeURIComponent(campaignId)}/`,
  );
  if (!ok) {
    throw new Error(`Smartlead get campaign HTTP ${status}: ${text.slice(0, 400)}`);
  }
  return (raw && typeof raw === "object" ? raw : { raw }) as Record<string, unknown>;
}

function smartleadStatusError(status: number, text: string): string {
  const clean = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return `HTTP ${status}: ${clean.slice(0, 400)}`;
}

function smartleadStatusAlreadyRunning(text: string): boolean {
  return /already\s*(active|started|running)/i.test(text) ||
    /"status"\s*:\s*"ACTIVE"/i.test(text);
}

/**
 * Smartlead only accepts POST /campaigns/{id}/status.
 * PATCH returns HTML 404 ("Cannot PATCH") and was hiding the real POST error.
 * Start value is START (the campaign then reads back as ACTIVE). Pause is PAUSED, with PAUSE as fallback.
 */
async function smartleadSetCampaignStatus(
  campaignId: string,
  statuses: string[],
): Promise<void> {
  let rejection = "";
  for (const status of statuses) {
    const result = await smartleadFetch(
      `/campaigns/${encodeURIComponent(campaignId)}/status`,
      { method: "POST", body: JSON.stringify({ status }) },
    );
    if (result.ok || result.status === 409 || smartleadStatusAlreadyRunning(result.text)) return;
    const detail = smartleadStatusError(result.status, result.text);
    const invalidStatus = /invalid|must be one of|enum|unexpected/i.test(result.text);
    if (!invalidStatus) {
      throw new Error(`Smartlead no pudo cambiar el estado a ${status} (${detail}).`);
    }
    rejection = detail;
  }
  throw new Error(
    `Smartlead no pudo cambiar el estado (${rejection || "ningún valor aceptado"}).`,
  );
}

export async function smartleadStartCampaign(campaignId: string): Promise<void> {
  await smartleadSetCampaignStatus(campaignId, ["START", "ACTIVE"]);
}

async function smartleadReadStatus(campaignId: string): Promise<string | null> {
  try {
    const camp = await smartleadGetCampaign(campaignId);
    return camp.status != null ? String(camp.status) : null;
  } catch {
    return null;
  }
}

/**
 * Solo reanuda (PAUSED/DRAFTED → ACTIVE). No toca secuencia ni pausa de nuevo.
 */
export async function smartleadResumeCampaign(
  campaignId: string,
  settingsInput?: Partial<SdrCampaignSettings> | null,
): Promise<{ started: true; smartlead_status: string | null }> {
  // START con cron vacío responde 500: "Cron Exp value is empty".
  await smartleadUpsertSchedule(campaignId, settingsInput ?? DEFAULT_SDR_SETTINGS);
  await smartleadStartCampaign(campaignId);
  // A veces START responde OK pero Smartlead sigue PAUSED (p.ej. bounce threshold / UI).
  // Reintento corto.
  let status = await smartleadReadStatus(campaignId);
  if (status && /pause|draft/i.test(status)) {
    await new Promise((r) => setTimeout(r, 800));
    await smartleadStartCampaign(campaignId);
    status = await smartleadReadStatus(campaignId);
  }
  if (status && /pause/i.test(status)) {
    throw new Error(
      `Smartlead sigue en ${status} tras START. Abre la campaña en Smartlead y confirma «Resume» ` +
        `(el texto del bounce threshold es un aviso estándar, no implica que hayas rebotado).`,
    );
  }
  return { started: true, smartlead_status: status ?? "ACTIVE" };
}

/**
 * Repara secuencia + horario + buzón y arranca la campaña (Draft/Paused → ACTIVE).
 * Usar en Lanzar; para solo reanudar preferir smartleadResumeCampaign.
 */
export async function smartleadActivateCampaign(input: {
  campaignId: string;
  settings?: Partial<SdrCampaignSettings> | null;
  emailAccountId?: number | null;
}): Promise<{ started: true; smartlead_status: string | null }> {
  const settings = normalizeSdrSettings(input.settings ?? DEFAULT_SDR_SETTINGS);
  if (input.emailAccountId && Number.isFinite(input.emailAccountId) && input.emailAccountId > 0) {
    await smartleadSyncExclusiveEmailAccount(input.campaignId, input.emailAccountId);
  }
  await smartleadEnsureOutreachReady(input.campaignId, settings);
  return await smartleadResumeCampaign(input.campaignId, settings);
}

/** Pause so sequences can be rewritten on an ACTIVE campaign. */
export async function smartleadPauseCampaign(campaignId: string): Promise<void> {
  await smartleadSetCampaignStatus(campaignId, ["PAUSED", "PAUSE"]);
}

/**
 * Ensure sequence + schedule exist on an existing Smartlead campaign (draft fix / repair).
 * Pauses briefly if needed, upserts cadence from CRM settings; does NOT start.
 */
export async function smartleadEnsureOutreachReady(
  campaignId: string,
  settingsInput?: Partial<SdrCampaignSettings> | string | null,
): Promise<void> {
  const settings = normalizeSdrSettings(
    typeof settingsInput === "string"
      ? { ...DEFAULT_SDR_SETTINGS, timezone: settingsInput }
      : settingsInput ?? DEFAULT_SDR_SETTINGS,
  );
  try {
    await smartleadPauseCampaign(campaignId);
  } catch {
    /* draft campaigns may reject pause — ignore */
  }
  await smartleadUpsertPersonalizedSequence(campaignId, settings);
  await smartleadUpsertSchedule(campaignId, settings);
}

/** Mark contacted leads as lost after the full cadence with no reply (~10 calendar days). */
export async function markExhaustedLeadsLost(
  admin: ReturnType<typeof createAdmin>["admin"],
  campaignId: string,
  graceDays = 10,
): Promise<number> {
  const cutoff = new Date(Date.now() - graceDays * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("sdr_leads")
    .update({ status: "lost" })
    .eq("campaign_id", campaignId)
    .eq("status", "contacted")
    .lt("last_contacted_at", cutoff)
    .select("id");
  if (error) {
    console.warn("markExhaustedLeadsLost:", error.message);
    return 0;
  }
  return (data ?? []).length;
}

export function buildOutreachReplyWebhookUrl(supabaseUrl: string): string {
  const secret = envGet("WEBHOOK_SECRET") || envGet("SDR_WEBHOOK_SECRET");
  if (!secret) {
    throw new Error("WEBHOOK_SECRET (o SDR_WEBHOOK_SECRET) no está configurado.");
  }
  const base = supabaseUrl.replace(/\/+$/, "");
  return `${base}/functions/v1/outreach-reply?secret=${encodeURIComponent(secret)}`;
}

/** Create Smartlead campaign + mailbox + sequence + reply webhook; returns ESP campaign id. */
export async function smartleadProvisionCampaign(input: {
  name: string;
  emailAccountId: number;
  supabaseUrl: string;
  timezone?: string;
  settings?: Partial<SdrCampaignSettings> | null;
}): Promise<{
  outreach_campaign_id: string;
  webhook_id: string | null;
  webhook_url: string;
  email_account_id: number;
}> {
  const settings = normalizeSdrSettings({
    ...DEFAULT_SDR_SETTINGS,
    ...(input.settings ?? {}),
    ...(input.timezone ? { timezone: input.timezone } : {}),
  });
  const created = await smartleadCreateCampaign(input.name);
  // Exclusive mailbox: create often auto-adds every account in the Smartlead workspace
  // (other brands sharing the same Smartlead workspace). Keep only the selected one.
  const sync = await smartleadSyncExclusiveEmailAccount(created.id, input.emailAccountId);
  if (sync.detached.length > 0) {
    console.info(
      `smartleadProvisionCampaign: detached extra mailboxes from ${created.id}:`,
      sync.detached.join(","),
    );
  }
  await smartleadUpsertPersonalizedSequence(created.id, settings);
  await smartleadUpsertSchedule(created.id, settings);
  const webhookUrl = buildOutreachReplyWebhookUrl(input.supabaseUrl);
  const webhook = await smartleadCreateCampaignWebhook({
    campaignId: created.id,
    name: `Proposalyze replies · ${input.name}`.slice(0, 80),
    webhookUrl,
  });
  return {
    outreach_campaign_id: created.id,
    webhook_id: webhook.id,
    webhook_url: webhookUrl,
    email_account_id: input.emailAccountId,
  };
}

/** Cuenta leads reales en una campaña Smartlead (GET /leads). */
export async function smartleadCountCampaignLeads(campaignId: string): Promise<number> {
  const { ok, status, raw, text } = await smartleadFetch(
    `/campaigns/${encodeURIComponent(campaignId)}/leads?offset=0&limit=1`,
  );
  if (!ok) {
    throw new Error(`Smartlead list leads HTTP ${status}: ${text.slice(0, 300)}`);
  }
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  // total_leads es el nº de personas. total_count de /analytics es otra métrica (pasos × leads).
  const total = Number(obj.total_leads ?? obj.total ?? obj.count);
  if (Number.isFinite(total)) return total;
  if (Array.isArray(obj.data)) return obj.data.length;
  if (Array.isArray(raw)) return raw.length;
  return 0;
}

/**
 * Métricas de campaña Smartlead (GET /campaigns/{id}/analytics).
 * Sent/Opened/Clicked/Replied/Bounced salen de esta respuesta.
 * Leads lo rellena el caller con GET /leads (lead_count): importar N leads no es haber enviado N emails.
 * OOO, Positive y Sender Bounced valen 0 si el payload no trae el campo.
 */
export type SmartleadCampaignAnalytics = {
  leads: number;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  replied_ooo: number;
  positive: number;
  bounced: number;
  sender_bounced: number;
};

function slRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

/** Primer campo presente y numérico. Un 0 explícito no se sustituye por el alias siguiente. */
function slFirstCount(
  sources: Array<{ obj: Record<string, unknown>; keys: string[] }>,
): number {
  for (const { obj, keys } of sources) {
    for (const key of keys) {
      const raw = obj[key];
      if (raw == null || raw === "") continue;
      const n = Number(raw);
      if (Number.isFinite(n)) return Math.max(0, Math.round(n));
    }
  }
  return 0;
}

export async function smartleadGetCampaignAnalytics(
  campaignId: string,
): Promise<SmartleadCampaignAnalytics> {
  const { ok, status, raw, text } = await smartleadFetch(
    `/campaigns/${encodeURIComponent(campaignId)}/analytics`,
  );
  if (!ok) {
    throw new Error(`Smartlead analytics HTTP ${status}: ${text.slice(0, 300)}`);
  }
  const root = slRecord(raw);
  const nested = slRecord(root.data);
  const obj = (
    root.sent_count != null ||
    root.total_sent != null ||
    root.reply_count != null ||
    root.total_replied != null
  )
    ? root
    : (Object.keys(nested).length > 0 ? nested : root);
  const stats = slRecord(obj.campaign_lead_stats);

  const oooKeys = ["ooo_reply_count", "replied_ooo_count", "out_of_office_count"];
  const hasExplicitOoo = oooKeys.some((key) => obj[key] != null && obj[key] !== "");
  let repliedOoo = slFirstCount([{ obj, keys: oooKeys }]);
  if (
    !hasExplicitOoo &&
    obj.total_reply_count != null &&
    obj.non_ooo_reply_count != null
  ) {
    const total = Number(obj.total_reply_count);
    const nonOoo = Number(obj.non_ooo_reply_count);
    if (Number.isFinite(total) && Number.isFinite(nonOoo)) {
      repliedOoo = Math.max(0, Math.round(total - nonOoo));
    }
  }

  // Leads = personas en la campaña (GET /leads). total_count de analytics es
  // emails de secuencia (N leads × pasos) y no puede usarse como KPI Leads.
  let leads = 0;
  try {
    leads = await smartleadCountCampaignLeads(campaignId);
  } catch (err) {
    console.warn(
      "smartlead lead count for analytics:",
      err instanceof Error ? err.message : err,
    );
  }

  return {
    leads,
    sent: slFirstCount([
      { obj, keys: ["sent_count", "total_sent", "unique_sent_count"] },
    ]),
    opened: slFirstCount([
      { obj, keys: ["unique_open_count", "open_count", "total_opened"] },
    ]),
    clicked: slFirstCount([
      { obj, keys: ["unique_click_count", "click_count", "total_clicked"] },
    ]),
    replied: slFirstCount([
      { obj, keys: ["reply_count", "total_replied"] },
    ]),
    replied_ooo: repliedOoo,
    positive: slFirstCount([
      { obj, keys: ["positive_reply_count", "positive_count"] },
      { obj: stats, keys: ["interested", "positive"] },
    ]),
    bounced: slFirstCount([
      { obj, keys: ["bounce_count", "total_bounced"] },
    ]),
    sender_bounced: slFirstCount([
      { obj, keys: ["sender_bounce_count"] },
    ]),
  };
}

export type SmartleadCampaignLeadRef = {
  lead_id: number;
  email: string;
  status: string | null;
  /** Al menos un email salió en Smartlead. STARTED/PENDING no cuenta. */
  has_been_sent: boolean;
};

/** STARTED/PENDING = en cola. INPROGRESS/COMPLETED o last_sent_time = enviado. */
function smartleadLeadHasBeenSent(row: Record<string, unknown>): boolean {
  const status = String(row.status ?? "").trim().toUpperCase();
  if (status === "STARTED" || status === "PENDING") return false;
  if (status === "INPROGRESS" || status === "COMPLETED") return true;
  const last = row.last_sent_time ?? row.lastSentTime ?? null;
  return last != null && String(last).trim() !== "";
}

/** Lista leads de una campaña (paginado, máx. 100/página). */
export async function smartleadListCampaignLeads(
  campaignId: string,
  max = 400,
): Promise<SmartleadCampaignLeadRef[]> {
  const out: SmartleadCampaignLeadRef[] = [];
  let offset = 0;
  const limit = 100;
  while (offset < max) {
    const { ok, status, raw, text } = await smartleadFetch(
      `/campaigns/${encodeURIComponent(campaignId)}/leads?offset=${offset}&limit=${limit}`,
    );
    if (!ok) {
      throw new Error(`Smartlead list leads HTTP ${status}: ${text.slice(0, 300)}`);
    }
    const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const rows = Array.isArray(obj.data)
      ? obj.data
      : Array.isArray(raw)
      ? raw
      : [];
    if (rows.length === 0) break;
    for (const row of rows) {
      const o = (row && typeof row === "object" ? row : {}) as Record<string, unknown>;
      const leadObj = (o.lead && typeof o.lead === "object" ? o.lead : o) as Record<
        string,
        unknown
      >;
      const leadId = Number(leadObj.id ?? o.lead_id ?? o.id);
      const email = String(leadObj.email ?? o.email ?? "").trim().toLowerCase();
      if (Number.isFinite(leadId) && email) {
        out.push({
          lead_id: leadId,
          email,
          status: o.status != null ? String(o.status) : null,
          has_been_sent: smartleadLeadHasBeenSent(o),
        });
      }
    }
    offset += rows.length;
    const total = Number(obj.total_leads);
    if (Number.isFinite(total) && offset >= total) break;
    if (rows.length < limit) break;
  }
  return out;
}

export type SmartleadLeadSyncResult = {
  queued: number;
  contacted: number;
  unchanged: number;
};

export type SdrCrmPerson = {
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  role?: string | null;
  country?: string | null;
  linkedin_url?: string | null;
};

/**
 * Crea o reutiliza la ficha en crm_leads (fase nuevo, fuente ai_sdr).
 * No pisa una ficha que ya avanzó de fase. Devuelve el id de crm_leads.
 */
export async function linkDiscoveredLeadToCrm(
  // deno-lint-ignore no-explicit-any
  admin: any,
  person: SdrCrmPerson,
  ownerId: string | null,
  sdrLeadId?: string | null,
): Promise<string | null> {
  const email = person.email.trim().toLowerCase();
  if (!email.includes("@")) return null;

  const { data: existing, error: findError } = await admin
    .from("crm_leads")
    .select("id, nombre, apellido, empresa, cargo, linkedin_url, region")
    .ilike("email", email)
    .maybeSingle();
  if (findError) throw new Error(findError.message);

  let crmId = existing?.id ? String(existing.id) : null;
  if (existing?.id) {
    const patch: Record<string, string | null> = {};
    if (!String(existing.nombre ?? "").trim() && person.first_name?.trim()) {
      patch.nombre = person.first_name.trim();
    }
    if (!String(existing.apellido ?? "").trim() && person.last_name?.trim()) {
      patch.apellido = person.last_name.trim();
    }
    if (!String(existing.empresa ?? "").trim() && person.company?.trim()) {
      patch.empresa = person.company.trim();
    }
    if (!String(existing.cargo ?? "").trim() && person.role?.trim()) {
      patch.cargo = person.role.trim();
    }
    if (!String(existing.linkedin_url ?? "").trim() && person.linkedin_url?.trim()) {
      patch.linkedin_url = person.linkedin_url.trim();
    }
    if (!String(existing.region ?? "").trim() && person.country?.trim()) {
      patch.region = person.country.trim();
    }
    if (Object.keys(patch).length > 0) {
      await admin.from("crm_leads").update(patch).eq("id", existing.id);
    }
  } else {
    const nombre = (person.first_name?.trim() || person.company?.trim() || email.split("@")[0] || "Lead");
    const { data: created, error: insertError } = await admin
      .from("crm_leads")
      .insert({
        nombre,
        apellido: person.last_name?.trim() || "",
        email,
        empresa: person.company?.trim() || "",
        cargo: person.role?.trim() || null,
        linkedin_url: person.linkedin_url?.trim() || null,
        region: person.country?.trim() || null,
        fase: "nuevo",
        fuente: "ai_sdr",
        comercial_id: ownerId,
        comentarios: "Descubierto por AI SDR (Apollo).",
      })
      .select("id")
      .maybeSingle();
    if (insertError) {
      if (/duplicate|unique/i.test(insertError.message)) {
        const { data: again } = await admin
          .from("crm_leads")
          .select("id")
          .ilike("email", email)
          .maybeSingle();
        crmId = again?.id ? String(again.id) : null;
      } else {
        throw new Error(insertError.message);
      }
    } else {
      crmId = created?.id ? String(created.id) : null;
    }
  }

  if (crmId && sdrLeadId) {
    await admin.from("sdr_leads").update({ crm_lead_id: crmId }).eq("id", sdrLeadId);
  }
  return crmId;
}

/** Pasa la ficha CRM a contactado solo si sigue en nuevo. Idempotente el mismo día. */
export async function markCrmLeadContacted(
  // deno-lint-ignore no-explicit-any
  admin: any,
  email: string,
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return;
  const { data: lead, error } = await admin
    .from("crm_leads")
    .select("id, fase")
    .ilike("email", normalized)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!lead?.id || lead.fase !== "nuevo") return;
  const today = new Date().toISOString().slice(0, 10);
  const { error: rpcError } = await admin.rpc("crm_register_outreach_contact", {
    p_email: normalized,
    p_from: today,
  });
  if (rpcError) throw new Error(rpcError.message);
}

/**
 * Alinea discovered|queued|contacted con Smartlead.
 * Importado sin envío → queued. Al menos un email → contacted.
 * No modifica replied, demo_*, unsubscribed, bounced ni lost.
 */
export async function syncCrmLeadStatusesFromSmartlead(
  // deno-lint-ignore no-explicit-any
  admin: any,
  campaignId: string,
  outreachId: string,
): Promise<SmartleadLeadSyncResult> {
  const remote = await smartleadListCampaignLeads(outreachId, 5000);
  const byEmail = new Map<string, SmartleadCampaignLeadRef>();
  for (const lead of remote) byEmail.set(lead.email, lead);

  const { data, error } = await admin
    .from("sdr_leads")
    .select("id, email, status, first_name, last_name, company, role, country, linkedin_url")
    .eq("campaign_id", campaignId)
    .in("status", ["discovered", "queued", "contacted"]);
  if (error) throw new Error(error.message);

  type SyncRow = {
    id: string;
    email: string | null;
    status: string;
    first_name: string | null;
    last_name: string | null;
    company: string | null;
    role: string | null;
    country: string | null;
    linkedin_url: string | null;
  };
  const toQueued: string[] = [];
  const toContacted: string[] = [];
  const promote: SyncRow[] = [];
  let unchanged = 0;
  for (const row of (data ?? []) as SyncRow[]) {
    const email = String(row.email ?? "").trim().toLowerCase();
    const remoteLead = email ? byEmail.get(email) : undefined;
    if (!remoteLead) {
      unchanged += 1;
      continue;
    }
    const next = remoteLead.has_been_sent ? "contacted" : "queued";
    if (row.status === next) {
      unchanged += 1;
      if (next === "contacted") promote.push(row);
      continue;
    }
    if (next === "contacted") {
      toContacted.push(row.id);
      promote.push(row);
    } else {
      toQueued.push(row.id);
    }
  }

  const now = new Date().toISOString();
  for (let i = 0; i < toQueued.length; i += 100) {
    const slice = toQueued.slice(i, i + 100);
    const { error: updateError } = await admin
      .from("sdr_leads")
      .update({ status: "queued" })
      .in("id", slice);
    if (updateError) throw new Error(updateError.message);
  }
  for (let i = 0; i < toContacted.length; i += 100) {
    const slice = toContacted.slice(i, i + 100);
    const { error: updateError } = await admin
      .from("sdr_leads")
      .update({ status: "contacted", last_contacted_at: now })
      .in("id", slice);
    if (updateError) throw new Error(updateError.message);
  }

  for (const row of promote) {
    const email = String(row.email ?? "").trim().toLowerCase();
    if (!email.includes("@")) continue;
    try {
      await linkDiscoveredLeadToCrm(admin, {
        email,
        first_name: row.first_name,
        last_name: row.last_name,
        company: row.company,
        role: row.role,
        country: row.country,
        linkedin_url: row.linkedin_url,
      }, null, row.id);
      await markCrmLeadContacted(admin, email);
    } catch (err) {
      console.warn(
        "crm lead contact sync skipped:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  return {
    queued: toQueued.length,
    contacted: toContacted.length,
    unchanged,
  };
}

/** Actualiza custom_fields de un lead ya existente en la campaña. */
export async function smartleadUpdateLead(
  campaignId: string,
  leadId: number,
  input: {
    email: string;
    first_name?: string | null;
    last_name?: string | null;
    company_name?: string | null;
    custom_fields?: Record<string, string>;
  },
): Promise<void> {
  const { ok, status, text } = await smartleadFetch(
    `/campaigns/${encodeURIComponent(campaignId)}/leads/${encodeURIComponent(String(leadId))}/`,
    {
      method: "POST",
      body: JSON.stringify({
        email: input.email,
        first_name: input.first_name ?? "",
        last_name: input.last_name ?? "",
        company_name: input.company_name ?? "",
        custom_fields: input.custom_fields ?? {},
      }),
    },
  );
  if (!ok) {
    throw new Error(`Smartlead update lead HTTP ${status}: ${text.slice(0, 300)}`);
  }
}

type SmartleadLeadPayload = {
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  custom_fields?: Record<string, string>;
};

/**
 * Si el add marca already_added / duplicados, actualiza custom_fields
 * (p.ej. body con Calendly nuevo) en los leads ya presentes.
 */
async function smartleadRefreshExistingCustomFields(
  campaignId: string,
  leads: SmartleadLeadPayload[],
): Promise<number> {
  if (leads.length === 0) return 0;
  const existing = await smartleadListCampaignLeads(campaignId);
  const byEmail = new Map(existing.map((l) => [l.email, l.lead_id]));
  let updated = 0;
  for (const lead of leads) {
    const email = lead.email.trim().toLowerCase();
    const leadId = byEmail.get(email);
    if (!leadId) continue;
    await smartleadUpdateLead(campaignId, leadId, {
      email: lead.email,
      first_name: lead.first_name,
      last_name: lead.last_name,
      company_name: lead.company_name,
      custom_fields: lead.custom_fields,
    });
    updated += 1;
  }
  return updated;
}

/** Push leads into Smartlead campaign (no SMTP from our servers). */
export async function smartleadAddLeads(
  campaignId: string,
  leads: SmartleadLeadPayload[],
): Promise<{ uploaded: number; skipped: number; updated: number; raw: unknown }> {
  const apiKey = envGet("SMARTLEAD_API_KEY");
  if (!apiKey) throw new Error("SMARTLEAD_API_KEY no está configurada.");
  if (!campaignId) throw new Error("Falta outreach_campaign_id de Smartlead en la campaña.");
  if (leads.length === 0) return { uploaded: 0, skipped: 0, updated: 0, raw: null };

  const before = await smartleadCountCampaignLeads(campaignId).catch(() => null);

  const response = await fetch(
    `https://server.smartlead.ai/api/v1/campaigns/${encodeURIComponent(campaignId)}/leads?api_key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lead_list: leads.map((l) => ({
          email: l.email,
          first_name: l.first_name ?? "",
          last_name: l.last_name ?? "",
          company_name: l.company_name ?? "",
          custom_fields: l.custom_fields ?? {},
        })),
        settings: {
          ignore_global_block_list: false,
          ignore_unsubscribe_list: false,
          ignore_community_bounce_list: false,
          // true = permitir leads que ya existen en otras campañas del workspace
          ignore_duplicate_leads_in_other_campaign: true,
          return_lead_ids: true,
        },
      }),
    },
  );
  const text = await response.text();
  let raw: unknown = text;
  try {
    raw = JSON.parse(text);
  } catch {
    /* keep text */
  }
  if (!response.ok) {
    throw new Error(`Smartlead HTTP ${response.status}: ${text.slice(0, 400)}`);
  }
  const obj = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<
    string,
    unknown
  >;
  const skipped = Number(
    obj.skipped_count ?? obj.already_added_to_campaign ?? 0,
  );
  const already = Number(obj.already_added_to_campaign ?? 0);
  let added = Number(obj.added_count ?? obj.upload_count);

  // Nunca asumir leads.length si falta contador: verificar contra el GET real.
  if (!Number.isFinite(added)) {
    const after = await smartleadCountCampaignLeads(campaignId).catch(() => null);
    if (before != null && after != null) {
      added = Math.max(0, after - before);
    } else {
      added = 0;
    }
  }

  // Re-lanzar: leads ya en campaña → no es fallo; refrescar custom_fields (Calendly/body).
  if (added <= 0 && leads.length > 0) {
    const after = await smartleadCountCampaignLeads(campaignId).catch(() => null);
    const alreadyInCampaign =
      (Number.isFinite(already) && already > 0) ||
      (after != null && after > 0 && (before == null || after >= before));
    if (alreadyInCampaign) {
      const updated = await smartleadRefreshExistingCustomFields(campaignId, leads);
      if (updated > 0 || (after != null && after > 0)) {
        return {
          uploaded: 0,
          skipped: Number.isFinite(skipped) ? skipped : already || leads.length,
          updated,
          raw,
        };
      }
    }
    const skippedHint = Array.isArray(obj.skipped_leads)
      ? JSON.stringify(obj.skipped_leads).slice(0, 280)
      : "";
    throw new Error(
      `Smartlead importó 0 leads (skipped=${Number.isFinite(skipped) ? skipped : "?"}` +
        `${after != null ? `, total_en_campaña=${after}` : ""}). ` +
        `${skippedHint || text.slice(0, 280)}. ` +
        `Si la campaña está COMPLETED vacía, deja de arrancarla antes de importar; ` +
        `pausa → importa → START.`,
    );
  }

  // Aunque haya añadidos, refresca custom_fields de los que ya estaban (partial overlap).
  let updated = 0;
  if (Number.isFinite(already) && already > 0) {
    updated = await smartleadRefreshExistingCustomFields(campaignId, leads).catch(() => 0);
  }

  return {
    uploaded: added,
    skipped: Number.isFinite(skipped) ? skipped : 0,
    updated,
    raw,
  };
}

/**
 * Deja la campaña lista para RECIBIR leads.
 * Importante: NO hacer START/ACTIVE con 0 leads — Smartlead la pasa a COMPLETED
 * y luego el import no entra (o entra y la UI sigue en 0).
 */
export async function smartleadPrepareForLeadImport(
  campaignId: string,
  settingsInput?: Partial<SdrCampaignSettings> | null,
): Promise<{ prior_status: string | null }> {
  let prior: string | null = null;
  try {
    const camp = await smartleadGetCampaign(campaignId);
    prior = camp.status != null ? String(camp.status) : null;
  } catch {
    prior = null;
  }
  // Solo pausar + secuencia/horario. START va DESPUÉS del import.
  await smartleadEnsureOutreachReady(campaignId, settingsInput ?? DEFAULT_SDR_SETTINGS);

  // Si sigue COMPLETED/STOPPED tras pause, reintentar PAUSED (nunca START vacío).
  const after = await smartleadReadStatus(campaignId);
  if (after && /completed|stopped|archived/i.test(after)) {
    try {
      await smartleadPauseCampaign(campaignId);
    } catch (err) {
      console.warn(
        "smartleadPrepareForLeadImport PAUSED:",
        err instanceof Error ? err.message : err,
      );
    }
  }
  return { prior_status: prior };
}

/** Push leads into Instantly campaign. */
export async function instantlyAddLeads(
  campaignId: string,
  leads: Array<{
    email: string;
    first_name?: string | null;
    last_name?: string | null;
    company_name?: string | null;
    custom_variables?: Record<string, string>;
  }>,
): Promise<{ uploaded: number; raw: unknown }> {
  const apiKey = envGet("INSTANTLY_API_KEY");
  if (!apiKey) throw new Error("INSTANTLY_API_KEY no está configurada.");
  if (!campaignId) throw new Error("Falta outreach_campaign_id de Instantly en la campaña.");

  const response = await fetch("https://api.instantly.ai/api/v2/leads/add", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      campaign_id: campaignId,
      skip_if_in_workspace: true,
      skip_if_in_campaign: true,
      leads: leads.map((l) => ({
        email: l.email,
        first_name: l.first_name ?? undefined,
        last_name: l.last_name ?? undefined,
        company_name: l.company_name ?? undefined,
        custom_variables: l.custom_variables ?? {},
      })),
    }),
  });
  const text = await response.text();
  let raw: unknown = text;
  try {
    raw = JSON.parse(text);
  } catch {
    /* keep text */
  }
  if (!response.ok) {
    throw new Error(`Instantly HTTP ${response.status}: ${text.slice(0, 400)}`);
  }
  return { uploaded: leads.length, raw };
}

export async function outreachStopSequence(
  provider: OutreachProvider,
  campaignId: string | null,
  email: string,
): Promise<void> {
  if (!campaignId || !email || provider !== "smartlead") return;
  const apiKey = envGet("SMARTLEAD_API_KEY");
  if (!apiKey) throw new Error("SMARTLEAD_API_KEY no está configurada.");
  const response = await fetch(
    `https://server.smartlead.ai/api/v1/campaigns/${encodeURIComponent(campaignId)}/leads/${encodeURIComponent(email)}/?api_key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED" }),
    },
  );
  if (response.ok) return;
  const text = await response.text();
  if (/already|completed|paused|not found/i.test(text)) return;
  throw new Error(`Smartlead stop lead HTTP ${response.status}: ${text.slice(0, 300)}`);
}

export async function outreachUnsubscribe(
  provider: OutreachProvider,
  campaignId: string | null,
  email: string,
): Promise<void> {
  if (!campaignId) return;
  if (provider === "smartlead") {
    const apiKey = envGet("SMARTLEAD_API_KEY");
    if (!apiKey) return;
    await fetch(
      `https://server.smartlead.ai/api/v1/campaigns/${encodeURIComponent(campaignId)}/leads/${encodeURIComponent(email)}/?api_key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      },
    ).catch(() => undefined);
    return;
  }
  const apiKey = envGet("INSTANTLY_API_KEY");
  if (!apiKey) return;
  await fetch("https://api.instantly.ai/api/v2/leads/update-interest-status", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      lead_email: email,
      campaign_id: campaignId,
      interest_value: -1,
    }),
  }).catch(() => undefined);
}

export async function outreachSendReply(input: {
  provider: OutreachProvider;
  email: string;
  replyBody: string;
  replySubject?: string | null;
  /** Smartlead `stats_id` of the inbound message. This keeps the reply on the thread. */
  emailStatsId?: string | null;
  replyMessageId?: string | null;
  replyEmailTime?: string | null;
  campaignId?: string | null;
}): Promise<void> {
  if (input.provider !== "smartlead") return;
  const apiKey = envGet("SMARTLEAD_API_KEY");
  const campaignId = input.campaignId?.trim() || "";
  const statsId = input.emailStatsId?.trim() || "";
  if (!apiKey || !campaignId || !statsId) {
    throw new Error("Smartlead reply: faltan API key, campaign_id o stats_id.");
  }
  const response = await fetch(
    `https://server.smartlead.ai/api/v1/campaigns/${encodeURIComponent(campaignId)}/reply-email-thread?api_key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email_stats_id: statsId,
        email_body: input.replyBody,
        reply_message_id: input.replyMessageId?.trim() || undefined,
        reply_email_time: input.replyEmailTime?.trim() || new Date().toISOString(),
        reply_email_body: input.replyBody,
        add_signature: true,
      }),
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Smartlead reply HTTP ${response.status}: ${text.slice(0, 400)}`);
  }
}

export function verifyWebhookSecret(req: Request): boolean {
  const expected = envGet("WEBHOOK_SECRET") || envGet("SDR_WEBHOOK_SECRET");
  if (!expected) {
    // Fail closed in production-like setups when secret is configured elsewhere as empty.
    return false;
  }
  const header =
    req.headers.get("x-webhook-secret")?.trim() ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    "";
  if (header.length > 0 && header === expected) return true;

  // Smartlead UI webhooks often cannot set custom headers — allow ?secret= / ?webhook_secret=
  try {
    const url = new URL(req.url);
    const fromQuery =
      url.searchParams.get("secret")?.trim() ||
      url.searchParams.get("webhook_secret")?.trim() ||
      "";
    return fromQuery.length > 0 && fromQuery === expected;
  } catch {
    return false;
  }
}

function replyRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function htmlToReplyText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function replyText(value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "[object Object]") return "";
    return /<[a-z][\s\S]*>/i.test(trimmed) ? htmlToReplyText(trimmed) : trimmed;
  }
  const record = replyRecord(value);
  if (!record) return "";
  return replyText(record.text) || replyText(record.body) || replyText(record.html);
}

/** Longest plain-text body. Smartlead's preview and text fields are often cut mid-word. */
function fullestReplyText(values: unknown[]): string {
  let best = "";
  const push = (value: unknown) => {
    const record = replyRecord(value);
    const pieces = record ? [record.text, record.body, record.html] : [value];
    for (const piece of pieces) {
      const text = replyText(piece);
      if (text.length > best.length) best = text;
    }
  };
  for (const value of values) push(value);
  return best;
}

function firstReplyString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

/** Bare addresses, in the order Smartlead/Instantly should be trusted. */
export function replyEmailCandidates(body: Record<string, unknown>): string[] {
  const nested = replyRecord(body.data) ?? replyRecord(body.payload) ?? body;
  // sl_lead_email is the lead as uploaded. to_email is who replied and may be an alias.
  // from_email is the sending mailbox in current Smartlead docs, so it stays last.
  const fields = [
    nested.sl_lead_email,
    body.sl_lead_email,
    nested.lead_email,
    body.lead_email,
    nested.to_email,
    body.to_email,
    nested.email,
    body.email,
    nested.reply_from,
    body.reply_from,
    nested.from_email,
    body.from_email,
  ];
  const out: string[] = [];
  const push = (email: string) => {
    if (email && !out.includes(email)) out.push(email);
  };
  for (const field of fields) {
    const raw = typeof field === "string" ? field.toLowerCase() : "";
    if (!raw) continue;
    const found = raw.match(/[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/gi) ?? [];
    for (const email of found) {
      const bare = email.replace(/\.+$/, "");
      push(bare);
      const unaliased = bare.replace(/^([^+@]+)\+[^@]*(@.+)$/, "$1$2");
      if (unaliased !== bare) push(unaliased);
    }
  }
  return out;
}

export function parseReplyPayload(body: Record<string, unknown>): {
  email: string;
  emails: string[];
  message: string;
  subject: string | null;
  externalMessageId: string | null;
  emailStatsId: string | null;
  replyMessageId: string | null;
  replyEmailTime: string | null;
  campaignExternalId: string | null;
  event: string;
} {
  const nested = replyRecord(body.data) ?? replyRecord(body.payload) ?? body;
  const emails = replyEmailCandidates(body);
  const replyMessage = replyRecord(nested.reply_message) ?? replyRecord(body.reply_message);
  // preview_text and reply_message.text are often cut mid-word. Keep the longest body.
  const message = fullestReplyText([
    replyMessage?.html,
    replyMessage?.text,
    replyMessage?.body,
    nested.reply_body,
    body.reply_body,
    nested.reply_text,
    body.reply_text,
    nested.body,
    nested.text,
    nested.message,
    body.message,
    nested.preview_text,
    body.preview_text,
  ]);

  const subject = firstReplyString(nested.subject, nested.reply_subject, body.subject);
  const emailStatsId = firstReplyString(nested.stats_id, nested.email_stats_id, body.stats_id);
  const replyMessageId = firstReplyString(replyMessage?.message_id, nested.message_id, body.message_id);
  const externalMessageId = emailStatsId ?? replyMessageId;
  const replyEmailTime = firstReplyString(
    replyMessage?.time,
    nested.event_timestamp,
    nested.time_replied,
    body.event_timestamp,
  );
  const campaignExternalId = firstReplyString(nested.campaign_id, body.campaign_id);
  const event = String(
    firstReplyString(nested.event_type, body.event_type, nested.event, body.event, nested.type) ??
      "reply",
  ).toLowerCase();

  return {
    email: emails[0] ?? "",
    emails,
    message,
    subject,
    externalMessageId,
    emailStatsId,
    replyMessageId,
    replyEmailTime,
    campaignExternalId,
    event,
  };
}
