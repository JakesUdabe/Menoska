import type { BulletinSectionCriteria } from "./and-filter";

export type BulletinFrequency = "daily" | "weekly" | "biweekly" | "monthly";
export type BulletinStatus = "draft" | "active" | "paused";
export type BulletinMode = "common" | "advanced";

export type BulletinSection = {
  title: string;
  companies: string[];
  technologies: string[];
};

export type BulletinRecipient = {
  email: string;
  companies: string[];
  technologies: string[];
};

export type StoredBulletin = {
  id: string;
  createdBy: string;
  organizationId: string;
  name: string;
  subject: string;
  language: string;
  frequency: BulletinFrequency;
  sendDay: number | null;
  sendHour: number;
  timezone: string;
  recipients: BulletinRecipient[];
  mode: BulletinMode;
  nlQuery: string;
  sections: BulletinSection[];
  status: BulletinStatus;
  createdAt: string;
  updatedAt: string;
};

const KEY = "abi_bulletins";

const SEED: StoredBulletin[] = [
  {
    id: "b1",
    createdBy: "user-client",
    organizationId: "org-menoska",
    name: "Competencia automoción EU",
    subject: "Vigilancia · automoción y electrónica flexible",
    language: "es",
    frequency: "weekly",
    sendDay: 1,
    sendHour: 7,
    timezone: "UTC",
    recipients: [
      { email: "comite.rd@menoska.consulting", companies: [], technologies: [] },
      { email: "unai@menoska.consulting", companies: [], technologies: [] },
    ],
    mode: "common",
    nlQuery: "",
    sections: [
      {
        title: "Competencia directa",
        companies: ["Bosch", "Continental"],
        technologies: ["flexible electronics", "automotive"],
      },
    ],
    status: "active",
    createdAt: "2026-09-01T08:00:00.000Z",
    updatedAt: "2026-09-10T08:00:00.000Z",
  },
  {
    id: "b2",
    createdBy: "user-admin",
    organizationId: "org-menoska",
    name: "Patentes emergentes printed electronics",
    subject: "Emerging patents · printed electronics",
    language: "en",
    frequency: "monthly",
    sendDay: null,
    sendHour: 8,
    timezone: "UTC",
    recipients: [{ email: "ip@menoska.consulting", companies: [], technologies: [] }],
    mode: "common",
    nlQuery:
      "Buscamos desarrollos en tecnologías de impresoras de electrónica flexible aplicados a empresas del sector automoción en Europa",
    sections: [
      {
        title: "Patentes emergentes",
        companies: ["LG Display", "Bosch"],
        technologies: ["printed electronics", "OLED", "flexible"],
      },
    ],
    status: "draft",
    createdAt: "2026-09-05T08:00:00.000Z",
    updatedAt: "2026-09-12T08:00:00.000Z",
  },
];

function newId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `b-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function asRecipient(value: unknown): BulletinRecipient | null {
  if (typeof value === "string") {
    const email = value.trim().toLowerCase();
    return email.includes("@") ? { email, companies: [], technologies: [] } : null;
  }
  if (!value || typeof value !== "object") return null;
  const row = value as { email?: unknown; companies?: unknown; technologies?: unknown };
  const email = String(row.email ?? "")
    .trim()
    .toLowerCase();
  if (!email.includes("@")) return null;
  return {
    email,
    companies: asStringArray(row.companies),
    technologies: asStringArray(row.technologies),
  };
}

export function defaultSection(index = 1): BulletinSection {
  return { title: `Sección ${index}`, companies: [], technologies: [] };
}

export function normalizeBulletin(raw: Partial<StoredBulletin> & { recipients?: unknown }): StoredBulletin {
  const recipients = Array.isArray(raw.recipients)
    ? raw.recipients.map(asRecipient).filter((row): row is BulletinRecipient => Boolean(row))
    : [];
  const sections = Array.isArray(raw.sections) && raw.sections.length > 0
    ? raw.sections.map((section, idx) => ({
        title: section?.title?.trim() || `Sección ${idx + 1}`,
        companies: asStringArray(section?.companies),
        technologies: asStringArray(section?.technologies),
      }))
    : [defaultSection()];

  return {
    id: raw.id || newId(),
    createdBy: raw.createdBy || "unknown",
    organizationId: raw.organizationId || "org-unknown",
    name: raw.name ?? "",
    subject: raw.subject ?? "",
    language: raw.language || "es",
    frequency: raw.frequency === "daily" || raw.frequency === "biweekly" || raw.frequency === "monthly" ? raw.frequency : "weekly",
    sendDay: typeof raw.sendDay === "number" ? raw.sendDay : 1,
    sendHour: typeof raw.sendHour === "number" && Number.isFinite(raw.sendHour) ? raw.sendHour : 7,
    timezone: raw.timezone || "UTC",
    recipients,
    mode: raw.mode === "advanced" ? "advanced" : "common",
    nlQuery: raw.nlQuery ?? "",
    sections,
    status: raw.status === "active" || raw.status === "paused" ? raw.status : "draft",
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

function readAll(): StoredBulletin[] {
  if (typeof window === "undefined") return SEED;
  try {
    const stored = localStorage.getItem(KEY);
    if (!stored) {
      localStorage.setItem(KEY, JSON.stringify(SEED));
      return SEED;
    }
    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) return SEED;
    return parsed.map((item) => normalizeBulletin(item as Partial<StoredBulletin>));
  } catch {
    return SEED;
  }
}

function writeAll(items: StoredBulletin[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function listBulletinsForUser(userId: string, organizationId: string | null, canSeeOrg: boolean): StoredBulletin[] {
  const all = readAll();
  if (canSeeOrg && organizationId) return all.filter((b) => b.organizationId === organizationId);
  return all.filter((b) => b.createdBy === userId);
}

export function getBulletin(id: string): StoredBulletin | undefined {
  return readAll().find((b) => b.id === id);
}

export function saveBulletin(input: StoredBulletin): StoredBulletin {
  const all = readAll();
  const next = normalizeBulletin({ ...input, updatedAt: new Date().toISOString() });
  const idx = all.findIndex((b) => b.id === next.id);
  if (idx >= 0) all[idx] = next;
  else all.unshift(next);
  writeAll(all);
  return next;
}

export function deleteBulletin(id: string) {
  writeAll(readAll().filter((b) => b.id !== id));
}

export function countActiveBulletins(userId: string): number {
  return readAll().filter((b) => b.createdBy === userId && b.status === "active").length;
}

export function emptyBulletin(userId: string, organizationId: string, locale: string): StoredBulletin {
  const now = new Date().toISOString();
  return {
    id: newId(),
    createdBy: userId,
    organizationId,
    name: "",
    subject: "",
    language: locale || "es",
    frequency: "weekly",
    sendDay: 1,
    sendHour: 7,
    timezone: "UTC",
    recipients: [],
    mode: "common",
    nlQuery: "",
    sections: [defaultSection()],
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}

export function commonCriteria(bulletin: Pick<StoredBulletin, "sections">): BulletinSectionCriteria {
  return {
    companies: bulletin.sections.flatMap((section) => section.companies),
    competitors: [],
    technologies: bulletin.sections.flatMap((section) => section.technologies),
  };
}

export function criteriaForRecipient(bulletin: StoredBulletin, email?: string): BulletinSectionCriteria {
  const defaults = commonCriteria(bulletin);
  if (bulletin.mode !== "advanced" || !email) return defaults;
  const recipient = bulletin.recipients.find((row) => row.email === email);
  if (!recipient) return defaults;
  return {
    companies: recipient.companies.length ? recipient.companies : defaults.companies,
    competitors: [],
    technologies: recipient.technologies.length ? recipient.technologies : defaults.technologies,
  };
}
