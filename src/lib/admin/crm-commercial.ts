import type { CrmLead, LeadPhase } from "@/lib/admin/types";

export const CRM_ACCOUNT_TYPES = ["consultora", "empresa", "organismo", "otro"] as const;
export const CRM_PLAN_TARGETS = ["starter", "business", "enterprise"] as const;
export const CRM_SOURCES = [
  "outbound_consultoras",
  "import_2026_07",
  "inbound",
  "manual",
  "referral",
  "resoluciones_prospeccion",
] as const;
export const CRM_ACTIVITY_TYPES = [
  "nota",
  "email",
  "linkedin",
  "llamada",
  "demo",
  "seguimiento",
  "post_demo",
] as const;

export type CrmAccountType = (typeof CRM_ACCOUNT_TYPES)[number];
export type CrmPlanTarget = (typeof CRM_PLAN_TARGETS)[number];
export type CrmSource = (typeof CRM_SOURCES)[number];
export type CrmActivityType = (typeof CRM_ACTIVITY_TYPES)[number];

export function addDaysIso(from: Date | string, days: number): string {
  const d = typeof from === "string" ? new Date(`${from}T00:00:00`) : new Date(from);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function followUpDates(from = todayIso()): { plus3: string; plus7: string; plus14: string } {
  return {
    plus3: addDaysIso(from, 3),
    plus7: addDaysIso(from, 7),
    plus14: addDaysIso(from, 14),
  };
}

/** Days to wait after contact attempt N (1-indexed) before the next touch. */
export function waitDaysForContact(
  contactCount: number,
  followupDays: number[] = [3, 7, 14],
): number {
  const days = followupDays.length > 0 ? followupDays : [3, 7, 14];
  const idx = Math.max(0, Math.min(Math.max(1, contactCount), days.length) - 1);
  return days[idx] ?? 3;
}

export function nextContactAfterCount(
  from: string,
  contactCount: number,
  followupDays: number[] = [3, 7, 14],
): string {
  return addDaysIso(from, waitDaysForContact(contactCount, followupDays));
}

export type ContactUrgency = "overdue" | "soon" | "later" | "none";

/** overdue = more than 1 day past; soon = today ±1 day; later = further out. */
export function contactUrgency(proximo: string | null | undefined, today = todayIso()): ContactUrgency {
  if (!proximo) return "none";
  const t = new Date(`${today}T00:00:00`).getTime();
  const p = new Date(`${proximo}T00:00:00`).getTime();
  if (!Number.isFinite(p)) return "none";
  const diffDays = Math.round((p - t) / 86_400_000);
  if (diffDays < -1) return "overdue";
  if (diffDays >= -1 && diffDays <= 1) return "soon";
  return "later";
}

export function isContactSoon(proximo: string | null | undefined, today = todayIso()): boolean {
  const u = contactUrgency(proximo, today);
  return u === "overdue" || u === "soon";
}

const PUBLIC_MAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "hotmail.com", "outlook.com", "live.com", "msn.com",
  "yahoo.com", "yahoo.es", "icloud.com", "me.com", "proton.me", "protonmail.com",
  "gmx.com", "gmx.es", "aol.com",
]);

export function crmEmailDomain(email: string | null | undefined): string {
  const normalized = (email ?? "").trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  return at >= 0 ? normalized.slice(at + 1) : "";
}

export function isPublicCrmMailDomain(domain: string): boolean {
  return PUBLIC_MAIL_DOMAINS.has(domain.trim().toLowerCase());
}

export function normalizeCrmCompany(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function leadWasContacted(lead: {
  fase?: string | null;
  contact_count?: number | null;
  ultimo_contacto?: string | null;
}): boolean {
  if ((lead.contact_count ?? 0) > 0) return true;
  if (lead.ultimo_contacto) return true;
  const fase = lead.fase ?? "";
  return fase === "contactado" || fase === "propuesta" || fase === "negociacion" || fase === "convertido";
}

export type CrmLeadCompanyTag = "client" | "contacted" | null;

/**
 * Prefer client over contacted when both apply.
 * Contacted matches corporate domain OR company name (same pattern as clients),
 * so archived contacted people still mark the active company.
 */
export function resolveLeadCompanyTag(
  lead: { email?: string | null; empresa?: string | null },
  contactedDomains: Set<string>,
  contactedCompanies: Set<string>,
  clientDomains: Set<string>,
  clientCompanies: Set<string>,
): CrmLeadCompanyTag {
  const domain = crmEmailDomain(lead.email);
  const company = normalizeCrmCompany(lead.empresa);
  const corporate = Boolean(domain && !isPublicCrmMailDomain(domain));

  if (
    (corporate && clientDomains.has(domain))
    || (company.length > 0 && clientCompanies.has(company))
  ) {
    return "client";
  }

  if (
    (corporate && contactedDomains.has(domain))
    || (company.length > 0 && contactedCompanies.has(company))
  ) {
    return "contacted";
  }

  return null;
}

/** Next outreach attempt number (1 = first cold email). */
export function nextOutreachAttempt(contactCount: number | null | undefined): number {
  return Math.max(1, (contactCount ?? 0) + 1);
}

/**
 * AI outreach draft only for the first cold contact (contact_count = 0).
 * Follow-ups (2nd / 3rd) are manual — no generated email.
 */
export function canGenerateOutreach(
  contactCount: number | null | undefined,
  _proximoContacto?: string | null | undefined,
  _today = todayIso(),
): { ok: boolean; attempt: number; waitUntil: string | null } {
  const attempt = nextOutreachAttempt(contactCount);
  if (attempt > 1) {
    return { ok: false, attempt, waitUntil: null };
  }
  return { ok: true, attempt, waitUntil: null };
}

/** UI status options: Contactado 1/2/3 map to fase=contactado + contact_count. */
export type CrmStatusOption =
  | "nuevo"
  | "contactado_1"
  | "contactado_2"
  | "contactado_3"
  | "propuesta"
  | "negociacion"
  | "convertido"
  | "perdido";

export const CRM_STATUS_OPTIONS: CrmStatusOption[] = [
  "nuevo",
  "contactado_1",
  "contactado_2",
  "contactado_3",
  "propuesta",
  "negociacion",
  "convertido",
  "perdido",
];

export const CRM_PIPELINE_STATUS_OPTIONS: CrmStatusOption[] = [
  "nuevo",
  "contactado_1",
  "contactado_2",
  "contactado_3",
  "propuesta",
  "negociacion",
  "perdido",
];

export function statusOptionFromLead(
  fase: string | null | undefined,
  contactCount: number | null | undefined,
): CrmStatusOption {
  if (fase === "contactado") {
    const n = Math.min(3, Math.max(1, contactCount && contactCount > 0 ? contactCount : 1));
    return (`contactado_${n}` as CrmStatusOption);
  }
  if (
    fase === "nuevo"
    || fase === "propuesta"
    || fase === "negociacion"
    || fase === "convertido"
    || fase === "perdido"
  ) {
    return fase;
  }
  return "nuevo";
}

export function leadFieldsFromStatusOption(
  option: CrmStatusOption,
  ultimoContacto: string | null | undefined,
  followupDays: number[] = [3, 7, 14],
  today = todayIso(),
  previousContactCount = 0,
): {
  fase: LeadPhase;
  contact_count: number;
  ultimo_contacto: string | null;
  proximo_contacto: string | null;
} {
  if (option === "contactado_1" || option === "contactado_2" || option === "contactado_3") {
    const count = Number(option.slice(-1)) as 1 | 2 | 3;
    const from = (ultimoContacto && ultimoContacto.trim()) || today;
    return {
      fase: "contactado",
      contact_count: count,
      ultimo_contacto: from,
      proximo_contacto: nextContactAfterCount(from, count, followupDays),
    };
  }
  if (option === "nuevo") {
    return {
      fase: "nuevo",
      contact_count: 0,
      ultimo_contacto: ultimoContacto || null,
      proximo_contacto: null,
    };
  }
  if (option === "perdido" || option === "convertido") {
    return {
      fase: option,
      contact_count: Math.max(0, previousContactCount),
      ultimo_contacto: ultimoContacto || null,
      proximo_contacto: null,
    };
  }
  // Later stages keep contact history; next date stays derived from last touch.
  const count = Math.max(0, previousContactCount);
  return {
    fase: option,
    contact_count: count,
    ultimo_contacto: ultimoContacto || null,
    proximo_contacto: count > 0
      ? syncProximoFromUltimo(ultimoContacto, count, followupDays, today)
      : null,
  };
}

/** Recalculate next-contact from last contact + contact count. */
export function syncProximoFromUltimo(
  ultimoContacto: string | null | undefined,
  contactCount: number | null | undefined,
  followupDays: number[] = [3, 7, 14],
  today = todayIso(),
): string | null {
  const count = contactCount ?? 0;
  if (count <= 0) return null;
  const from = (ultimoContacto && ultimoContacto.trim()) || today;
  return nextContactAfterCount(from, count, followupDays);
}

/** Instruction so the model knows this is follow-up #N. */
export function outreachAttemptInstruction(attempt: number): string {
  if (attempt <= 1) return "";
  return [
    `IMPORTANTE: este es el correo de seguimiento nº ${attempt}.`,
    `Ya se envió ${attempt - 1} contacto(s) previo(s) a esta misma persona y no hubo respuesta útil todavía.`,
    "No reescribas el cold email inicial ni repitas el mismo pitch palabra por palabra.",
    "Haz un follow-up breve, aporta un ángulo nuevo (capacidad operativa, evidencia de resoluciones o CTA distinto) y pide una respuesta concreta.",
  ].join(" ");
}

export function greetingName(lead: Pick<CrmLead, "nombre" | "empresa">): string {
  const name = (lead.nombre ?? "").trim();
  if (!name || name === "-" || name === lead.empresa) return "";
  return ` ${name.split(" ")[0]}`;
}

export function defaultEmailCopy(lead: Pick<CrmLead, "nombre" | "empresa" | "gancho">): string {
  const hook = (lead.gancho ?? "").trim()
    || "preparáis memorias de ayudas públicas con mucha carga operativa";
  return `Hola${greetingName(lead)},

En ${lead.empresa} ${hook}.

Proposalyze ayuda a localizar convocatorias encajadas, redactar memorias con evidencia y revisarlas antes de presentar, para que el equipo se centre en estrategia y cierre.

¿Os encaja una demo breve con una convocatoria vuestra?

Un saludo`;
}

export function defaultLinkedinCopy(lead: Pick<CrmLead, "empresa" | "gancho">): string {
  const hook = (lead.gancho ?? "").trim()
    || "redactáis muchas memorias de CDTI / Horizon / convocatorias autonómicas";
  return `Hola, en ${lead.empresa} ${hook}. Hemos montado una plataforma para consultoras: matching de convocatorias, redactor de memoria y evaluador previo. ¿Te va una demo de 20 min con un expediente vuestro?`;
}

export function defaultPostDemoNote(lead: Pick<CrmLead, "empresa">): string {
  return `Post-demo ${lead.empresa}:
- Convocatoria trabajada:
- Qué les encajó:
- Objeción principal:
- Siguiente paso (piloto / Business anual / no encaja):
- Fecha de cierre:`;
}

export type CrmCompanyGroup = {
  key: string;
  domain: string | null;
  companyName: string;
  /** Shared tax ID (CIF) across contacts of this company. */
  cif: string | null;
  contacts: CrmLead[];
  contactCount: number;
  /** Most frequent comercial_id among contacts (null if none assigned). */
  comercialId: string | null;
  phases: Partial<Record<string, number>>;
  nextContact: string | null;
  tag: CrmLeadCompanyTag;
};

/** Prefer the first non-empty CIF among company contacts. */
export function pickCompanyCif(contacts: Array<{ cif?: string | null }>): string | null {
  for (const lead of contacts) {
    const cif = (lead.cif ?? "").trim();
    if (cif) return cif;
  }
  return null;
}

/** Pick the most common non-null comercial_id; ties break by first seen. */
export function primaryComercialId(
  contacts: Array<{ comercial_id?: string | null }>,
): string | null {
  const counts = new Map<string, number>();
  let best: string | null = null;
  let bestN = 0;
  for (const c of contacts) {
    const id = c.comercial_id;
    if (!id) continue;
    const n = (counts.get(id) ?? 0) + 1;
    counts.set(id, n);
    if (n > bestN) {
      best = id;
      bestN = n;
    }
  }
  return best;
}

/** Group key: corporate email domain, else normalized company name, else email/id. */
export function crmCompanyGroupKey(lead: {
  id: string;
  email?: string | null;
  empresa?: string | null;
}): string {
  const domain = crmEmailDomain(lead.email);
  if (domain && !isPublicCrmMailDomain(domain)) return `d:${domain}`;
  const company = normalizeCrmCompany(lead.empresa);
  if (company) return `c:${company}`;
  const email = (lead.email ?? "").trim().toLowerCase();
  if (email) return `e:${email}`;
  return `id:${lead.id}`;
}

function pickCompanyDisplayName(contacts: CrmLead[], domain: string | null): string {
  const counts = new Map<string, number>();
  for (const lead of contacts) {
    const name = (lead.empresa ?? "").trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  let best = "";
  let bestN = 0;
  for (const [name, n] of counts) {
    if (n > bestN || (n === bestN && name.localeCompare(best) < 0)) {
      best = name;
      bestN = n;
    }
  }
  if (best) return best;
  return domain ?? contacts[0]?.email ?? "—";
}

export function groupLeadsByCompany(
  leads: CrmLead[],
  contactedDomains: Set<string>,
  contactedCompanies: Set<string>,
  clientDomains: Set<string>,
  clientCompanies: Set<string>,
): CrmCompanyGroup[] {
  const buckets = new Map<string, CrmLead[]>();
  for (const lead of leads) {
    const key = crmCompanyGroupKey(lead);
    const list = buckets.get(key);
    if (list) list.push(lead);
    else buckets.set(key, [lead]);
  }

  const groups: CrmCompanyGroup[] = [];
  for (const [key, contacts] of buckets) {
    const domain = key.startsWith("d:") ? key.slice(2) : null;
    const phases: Partial<Record<string, number>> = {};
    let nextContact: string | null = null;
    for (const lead of contacts) {
      phases[lead.fase] = (phases[lead.fase] ?? 0) + 1;
      // Closed outcomes have no next-contact cadence.
      if (lead.fase === "perdido" || lead.fase === "convertido") continue;
      if (lead.proximo_contacto) {
        if (!nextContact || lead.proximo_contacto < nextContact) {
          nextContact = lead.proximo_contacto;
        }
      }
    }
    const companyName = pickCompanyDisplayName(contacts, domain);
    // Prefer client; else contacted if any contact (or group domain/name) matches history.
    let tag: CrmLeadCompanyTag = null;
    for (const lead of contacts) {
      const t = resolveLeadCompanyTag(
        lead,
        contactedDomains,
        contactedCompanies,
        clientDomains,
        clientCompanies,
      );
      if (t === "client") {
        tag = "client";
        break;
      }
      if (t === "contacted") tag = "contacted";
    }
    if (tag !== "client" && domain && contactedDomains.has(domain)) {
      tag = "contacted";
    }
    if (tag !== "client") {
      const companyKey = key.startsWith("c:") ? key.slice(2) : normalizeCrmCompany(companyName);
      if (companyKey && contactedCompanies.has(companyKey)) tag = "contacted";
    }
    groups.push({
      key,
      domain,
      companyName,
      cif: pickCompanyCif(contacts),
      contacts,
      contactCount: contacts.length,
      comercialId: primaryComercialId(contacts),
      phases,
      nextContact,
      tag,
    });
  }

  groups.sort((a, b) => {
    if (a.contactCount !== b.contactCount) return b.contactCount - a.contactCount;
    return a.companyName.localeCompare(b.companyName);
  });
  return groups;
}

export type CommercialSender = {
  userId: string;
  fullName: string;
  jobTitle: string;
  workEmail: string;
};

export const DEFAULT_SENDER: CommercialSender = {
  userId: "default",
  fullName: "Equipo Menoska Consulting",
  jobTitle: "Menoska Consulting",
  workEmail: "hola@menoska.com",
};

export function userCanEmailLead(
  superAdmin: boolean,
  userId: string | undefined,
  lead: CrmLead | null,
): boolean {
  if (superAdmin) return true;
  if (!userId || !lead) return false;
  return (lead.comercial_id ?? "") === userId;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
