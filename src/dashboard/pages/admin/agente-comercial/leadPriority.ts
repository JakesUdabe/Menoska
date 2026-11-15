/** Prefer named people over generic mailbox addresses (info@, marketing@, …). */

const GENERIC_LOCAL_PARTS = new Set([
  "info",
  "contacto",
  "contact",
  "hello",
  "hola",
  "admin",
  "office",
  "oficina",
  "marketing",
  "comercial",
  "sales",
  "ventas",
  "support",
  "soporte",
  "help",
  "ayuda",
  "press",
  "prensa",
  "comunicacion",
  "comunicaciones",
  "reception",
  "recepcion",
  "general",
  "enquiries",
  "inquiries",
  "consultas",
  "proyectos",
  "projects",
  "rrhh",
  "hr",
  "noreply",
  "no-reply",
  "donotreply",
]);

function emailLocalPart(email: string): string {
  const at = email.indexOf("@");
  if (at < 1) return "";
  return email.slice(0, at).trim().toLowerCase();
}

/** True when the address looks like a shared/generic inbox, not a person. */
export function isGenericMailbox(email: string): boolean {
  const local = emailLocalPart(email);
  if (!local) return true;
  if (GENERIC_LOCAL_PARTS.has(local)) return true;
  if (local.startsWith("info") || local.startsWith("contact") || local.startsWith("marketing")) {
    return true;
  }
  return false;
}

type LeadLike = {
  name: string;
  email: string;
  company_name: string;
  position?: string | null;
};

/** Named person with a personal-looking email ranks above generic inboxes. */
export function isNamedContact(lead: LeadLike): boolean {
  if (isGenericMailbox(lead.email)) return false;
  const name = lead.name.trim().toLowerCase();
  if (!name) return false;
  const company = lead.company_name.trim().toLowerCase();
  const position = (lead.position ?? "").trim().toLowerCase();
  if (company && name === company) return false;
  if (position && name === position) return false;
  return true;
}

export function compareLeadsByPriority(a: LeadLike, b: LeadLike): number {
  const namedA = isNamedContact(a) ? 0 : 1;
  const namedB = isNamedContact(b) ? 0 : 1;
  if (namedA !== namedB) return namedA - namedB;
  return a.company_name.localeCompare(b.company_name, "es", { sensitivity: "base" });
}
