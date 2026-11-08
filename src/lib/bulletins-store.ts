import type { BulletinSectionCriteria } from "./and-filter";
import { readMigratedStorage, writeStorage } from "./storage-keys";

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
  maxItems: number;
  status: BulletinStatus;
  createdAt: string;
  updatedAt: string;
};

const KEY = "menoska_bulletins";
const OLD_KEY = "abi_bulletins";

const SEED: StoredBulletin[] = [
  {
    id: "b1",
    createdBy: "user-client",
    organizationId: "org-menoska",
    name: "Vigilancia · térmica de baterías",
    subject: "Vigilancia · Tesla y gestión térmica de packs",
    language: "es",
    frequency: "weekly",
    sendDay: 1,
    sendHour: 7,
    timezone: "Europe/Madrid",
    recipients: [{ email: "comite.rd@menoska.consulting", companies: [], technologies: [] }],
    mode: "common",
    nlQuery: "Patentes públicas de Tesla sobre thermal runaway y control de temperatura del battery pack",
    sections: [
      {
        title: "Familia de referencia",
        companies: ["Tesla"],
        technologies: ["battery", "thermal"],
      },
    ],
    maxItems: 8,
    status: "active",
    createdAt: "2026-10-01T08:00:00.000Z",
    updatedAt: "2026-10-20T08:00:00.000Z",
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

function uniqueLabels(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export function bulletinPool(bulletin: Pick<StoredBulletin, "sections">): BulletinSection {
  const first = bulletin.sections[0] ?? defaultSection();
  return {
    title: first.title,
    companies: uniqueLabels(bulletin.sections.flatMap((section) => asStringArray(section?.companies))),
    technologies: uniqueLabels(bulletin.sections.flatMap((section) => asStringArray(section?.technologies))),
  };
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function normalizeBulletin(raw: Partial<StoredBulletin> & { recipients?: unknown }): StoredBulletin {
  const sections = Array.isArray(raw.sections) && raw.sections.length > 0
    ? [bulletinPool({ sections: raw.sections })]
    : [defaultSection()];
  const pool = sections[0];
  const mode: BulletinMode = raw.mode === "advanced" ? "advanced" : "common";
  const parsedRecipients = Array.isArray(raw.recipients)
    ? raw.recipients.map(asRecipient).filter((row): row is BulletinRecipient => Boolean(row))
    : [];
  const inheritAll =
    mode === "advanced" &&
    parsedRecipients.length > 0 &&
    parsedRecipients.every((row) => row.companies.length === 0 && row.technologies.length === 0);
  const recipients = parsedRecipients.map((row) => {
    if (mode !== "advanced") return { ...row, companies: [], technologies: [] };
    if (inheritAll) return { ...row, companies: [...pool.companies], technologies: [...pool.technologies] };
    return {
      ...row,
      companies: uniqueLabels(row.companies).filter((item) => pool.companies.includes(item)),
      technologies: uniqueLabels(row.technologies).filter((item) => pool.technologies.includes(item)),
    };
  });

  return {
    id: raw.id || newId(),
    createdBy: raw.createdBy || "unknown",
    organizationId: raw.organizationId || "org-unknown",
    name: raw.name ?? "",
    subject: raw.subject ?? "",
    language: raw.language || "es",
    frequency: raw.frequency === "daily" || raw.frequency === "biweekly" || raw.frequency === "monthly" ? raw.frequency : "weekly",
    sendDay: typeof raw.sendDay === "number" ? raw.sendDay : 1,
    sendHour: clampInt(raw.sendHour, 7, 0, 23),
    timezone: raw.timezone || "UTC",
    recipients,
    mode,
    nlQuery: raw.nlQuery ?? "",
    sections,
    maxItems: clampInt(raw.maxItems, 10, 1, 50),
    status: raw.status === "active" || raw.status === "paused" ? raw.status : "draft",
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

function withShowcase(items: StoredBulletin[]): StoredBulletin[] {
  const seed = SEED[0];
  const rest = items.filter(
    (item) => item.id !== seed.id && item.name !== "Patentes emergentes printed electronics" && item.name !== "Competencia automoción EU",
  );
  return [seed, ...rest];
}

function readAll(): StoredBulletin[] {
  if (typeof window === "undefined") return SEED;
  try {
    const stored = readMigratedStorage(KEY, OLD_KEY);
    if (!stored) {
      writeStorage(KEY, JSON.stringify(SEED));
      return SEED;
    }
    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) return SEED;
    const normalized = parsed.map((item) => normalizeBulletin(item as Partial<StoredBulletin>));
    const needsShowcase = !normalized.some((item) => item.id === SEED[0].id && item.name === SEED[0].name);
    if (!needsShowcase) return normalized;
    const next = withShowcase(normalized);
    writeAll(next);
    return next;
  } catch {
    return SEED;
  }
}

function writeAll(items: StoredBulletin[]) {
  writeStorage(KEY, JSON.stringify(items));
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
    maxItems: 10,
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
    companies: recipient.companies,
    competitors: [],
    technologies: recipient.technologies,
  };
}
