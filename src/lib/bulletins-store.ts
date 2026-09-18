export type BulletinFrequency = "daily" | "weekly" | "biweekly" | "monthly";
export type BulletinStatus = "draft" | "active" | "paused";

export type BulletinSection = {
  title: string;
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
  recipients: string[];
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
    recipients: ["comite.rd@menoska.consulting", "unai@menoska.consulting"],
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
    recipients: ["ip@menoska.consulting"],
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

function readAll(): StoredBulletin[] {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      localStorage.setItem(KEY, JSON.stringify(SEED));
      return SEED;
    }
    const parsed = JSON.parse(raw) as StoredBulletin[];
    return Array.isArray(parsed) ? parsed : SEED;
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
  const next = { ...input, updatedAt: new Date().toISOString() };
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
  return {
    id: crypto.randomUUID(),
    createdBy: userId,
    organizationId,
    name: "",
    subject: "",
    language: locale,
    frequency: "weekly",
    sendDay: 1,
    sendHour: 7,
    timezone: "UTC",
    recipients: [],
    nlQuery: "",
    sections: [{ title: "Sección 1", companies: [], technologies: [] }],
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
