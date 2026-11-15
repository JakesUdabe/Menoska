export type SdrLanguage = "es" | "en" | "de" | "fr" | "it";
export type OutreachProvider = "smartlead" | "instantly";

export type SdrCampaignStatus =
  | "draft"
  | "enriching"
  | "ready"
  | "running"
  | "paused"
  | "completed";

export type SdrLeadStatus =
  | "discovered"
  | "queued"
  | "contacted"
  | "replied"
  | "demo_requested"
  | "demo_scheduled"
  | "unsubscribed"
  | "bounced"
  | "lost";

export type SdrConsentStatus =
  | "legitimate_interest_b2b"
  | "opted_in"
  | "unsubscribed"
  | "suppressed";

/** Ajustes comerciales editables en el CRM (cadencia Smartlead + lost + horario). */
export type SdrCampaignSettings = {
  /** Seguimiento tras el email 1 (días absolutos desde el envío inicial). */
  followup_day: number;
  /** Recordatorio final (días absolutos desde el envío inicial). */
  reminder_day: number;
  enable_followup: boolean;
  enable_reminder: boolean;
  /** Sin respuesta tras N días desde el primer contacto → status lost. */
  lost_after_days: number;
  timezone: string;
  /** 0=dom … 6=sáb (Smartlead usa el mismo esquema habitual 1–5 = lun–vie). */
  days_of_week: number[];
  start_hour: string;
  end_hour: string;
  min_time_btw_emails: number;
  max_new_leads_per_day: number;
  /** Instrucciones opcionales por paso (sobrescriben el brief por defecto). */
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
  /** Dominios escritos a mano (CIDETEC, deals abiertos, etc.). */
  exclude_domains: string[];
  /** Excluir clientes y empresas en perdido dentro del plazo de recontacto. */
  exclude_known_companies: boolean;
  /** Una empresa en perdido vuelve a ser buscable cuando el último contacto es más antiguo que esto. */
  lost_recontact_days: number;
};

/** Cargos que Apollo entiende. Máximo 10. Sin CEO ni CTO: no escriben la memoria. */
export const DEFAULT_SDR_ROLES = [
  "R&D Manager",
  "Head of R&D",
  "Innovation Manager",
  "Head of Innovation",
  "Grant Manager",
  "Director de I+D",
  "Responsable de Innovación",
  "Responsable de Financiación Pública",
];

/** Rangos reales de Apollo. 11–500 cubre consultora pequeña e industrial mediana. */
export const DEFAULT_SDR_COMPANY_SIZES = ["11,20", "21,50", "51,100", "101,200", "201,500"];

export const DEFAULT_SDR_COUNTRIES = ["Spain"];

/** Fuera de la primera campaña: CIDETEC, e Ideko y Talgo mientras sigan en conversación. */
export const DEFAULT_SDR_EXCLUDE_DOMAINS = ["cidetec.es", "ideko.es", "talgo.com"];

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
  exclude_domains: DEFAULT_SDR_EXCLUDE_DOMAINS,
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
          .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? "")
          .map((d) => d.replace(/^@/, ""))
          .filter((d) => d.includes(".")),
      )].slice(0, 1000);
    })(),
    exclude_known_companies: o.exclude_known_companies !== false,
    lost_recontact_days: clampInt(o.lost_recontact_days, DEFAULT_SDR_SETTINGS.lost_recontact_days, 1, 365),
  };
}

export interface SdrCampaign {
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
  status: SdrCampaignStatus;
  settings: SdrCampaignSettings;
  metrics: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SdrLead {
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
  crm_lead_id: string | null;
  status: SdrLeadStatus;
  consent_status: SdrConsentStatus;
  unsubscribed_at: string | null;
  last_contacted_at: string | null;
  created_at: string;
}

export interface SdrConversation {
  id: string;
  lead_id: string;
  campaign_id: string;
  sender: "agent" | "prospect";
  message_body: string;
  subject: string | null;
  intent: string | null;
  sentiment: string | null;
  created_at: string;
}

export interface SdrMetrics {
  leads_processed: number;
  emails_sent: number;
  replies: number;
  demos_scheduled: number;
  unsubscribed: number;
  conversion_rate: number;
}

/** Cifras de GET /campaigns/{id}/analytics. emails_sent del RPC no es Sent. */
export interface SmartleadCampaignAnalytics {
  leads: number;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  replied_ooo: number;
  positive: number;
  bounced: number;
  sender_bounced: number;
}

/** Mirror of edge DEFAULT_AGENT_PROMPT. */
export const DEFAULT_SDR_PROMPT = `Eres un comercial B2B de Proposalyze. Escribes correos fríos cortos, concretos y fáciles de leer, como una persona que conoce el trabajo de ayudas públicas. Cero relleno, cero hipérboles y cero plantilla idéntica para todos los leads. Nunca inventes clientes, logos, cifras, case studies, descuentos, cargos, ayudas concedidas, importes, CIF, expedientes ni convocatorias concretas.

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

No firmes con cargo, con “El equipo” ni con “Proposalyze”: la firma del buzón se añade sola. No escribas el pie de baja: lo añade el sistema.

## Cadencia
- Email 1. Asunto con la empresa y el dolor (por ejemplo “El cribado de convocatorias en {empresa}”). Cuerpo: pregunta ese dolor en {empresa}; si hay industria, una frase de que es habitual en ese sector; pregunta cómo lo llevan ahora. No nombres Proposalyze. Sin demo, sin reunión, sin calendario y sin enlaces. 60–90 palabras.
- Email 2. Asunto “Cómo Proposalyze puede ayudar a {empresa}”. No copies el email 1. Primera frase: retoma ese mismo dolor y presenta el vídeo con el enlace exacto que indique el sistema. Segundo párrafo, en prosa: qué hace Proposalyze respecto a ese dolor (matching de convocatorias, analista de resoluciones, redactor de memoria, revisor de memoria). Cierra el párrafo con “Espero que te resulte interesante.” Sin calendario y sin pedir demo. 90–130 palabras.
- Email 3. Asunto “Gracias y quedo a disposición”. Agradecimiento corto y puerta abierta si más adelante preparan una convocatoria o una memoria. Sin argumento nuevo, sin vídeo, sin calendario y sin culpa. No digas “último mensaje” ni “solo quería despedirme”. 35–60 palabras.

## Si responden
La demo de unos 15 minutos solo se ofrece cuando el prospecto contesta y muestra interés. Entonces, una frase de qué se ve (perfil, convocatoria, memoria, revisión) y el enlace de calendario si el sistema lo trae. Si no hay enlace, pide dos huecos. Nunca inventes una URL. No prometas revisar su memoria real por email.
Objeciones (precio, timing, ya tienen consultora, lo hacen en Excel): solo si el prospecto escribe. Una o dos frases. Si solo objeta, responde y deja la puerta abierta.
Baja o no interesado: confirma y no insistas.
Idioma = idioma del prospecto (ES/EN/DE/FR/IT). Asuntos humanos, sin clickbait y sin “Quick question”.`;
