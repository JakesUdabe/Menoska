import { readMigratedStorage, writeStorage } from "./storage-keys";
import {
  SHOWCASE_BULLETIN_ID,
  SHOWCASE_CASE,
  SHOWCASE_MARKET_ID,
  SHOWCASE_PROJECT_ID,
  SHOWCASE_SOTA_ID,
} from "./showcase-case";

export type ProjectLink = {
  id: string;
  kind: "worksheet" | "report" | "bulletin" | "other";
  refId: string;
  label: string;
  createdAt: string;
};

export type StoredProject = {
  id: string;
  organizationId: string;
  createdBy: string;
  name: string;
  description: string;
  status: "active" | "archived" | "draft";
  links: ProjectLink[];
  meta: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

const KEY = "menoska_projects";

function showcaseProject(): StoredProject {
  const now = "2026-10-20T08:00:00.000Z";
  return {
    id: SHOWCASE_PROJECT_ID,
    organizationId: "org-menoska",
    createdBy: "user-client",
    name: SHOWCASE_CASE.projectName,
    description: SHOWCASE_CASE.projectDescription,
    status: "active",
    createdAt: now,
    updatedAt: now,
    meta: { showcase: true },
    links: [
      {
        id: "lnk-bulletin",
        kind: "bulletin",
        refId: SHOWCASE_BULLETIN_ID,
        label: "Boletín · térmica de baterías",
        createdAt: now,
      },
      {
        id: "lnk-patents",
        kind: "worksheet",
        refId: "patentes-fto",
        label: "FTO",
        createdAt: now,
      },
      {
        id: "lnk-sota",
        kind: "report",
        refId: `estado_arte:${SHOWCASE_SOTA_ID}`,
        label: "Estado del arte",
        createdAt: now,
      },
      {
        id: "lnk-market",
        kind: "report",
        refId: `informe_mercado:${SHOWCASE_MARKET_ID}`,
        label: "Informe de mercado",
        createdAt: now,
      },
    ],
  };
}

function withoutMemo(project: StoredProject): StoredProject {
  const links = project.links
    .filter((link) => !link.refId.startsWith("memo:"))
    .map((link) => (link.refId === "patentes-fto" ? { ...link, label: "FTO" } : link));
  const description = project.description.replace("seguida hasta un memo.", "seguida hasta el informe.");
  const sameLinks = links.length === project.links.length && links.every((link, index) => link === project.links[index]);
  if (sameLinks && description === project.description) return project;
  return { ...project, links, description };
}

function readAll(): StoredProject[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = readMigratedStorage(KEY, "abi_projects");
    if (!raw) {
      const seeded = [showcaseProject()];
      writeAll(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as StoredProject[];
    if (!Array.isArray(parsed)) return [];
    const stripped = parsed.map(withoutMemo);
    const changed = stripped.some((project, index) => project !== parsed[index]);
    if (!stripped.some((item) => item.id === SHOWCASE_PROJECT_ID)) {
      const next = [showcaseProject(), ...stripped];
      writeAll(next);
      return next;
    }
    if (changed) writeAll(stripped);
    return stripped;
  } catch {
    return [];
  }
}

function writeAll(projects: StoredProject[]) {
  writeStorage(KEY, JSON.stringify(projects));
}

export function listProjectsLocal(
  userId: string,
  organizationId: string | null,
  seeOrg: boolean,
): StoredProject[] {
  return readAll()
    .filter((p) => {
      if (seeOrg && organizationId) return p.organizationId === organizationId;
      return p.createdBy === userId;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getProjectLocal(id: string): StoredProject | undefined {
  return readAll().find((p) => p.id === id);
}

export function saveProjectLocal(project: StoredProject): StoredProject {
  const all = readAll();
  const idx = all.findIndex((p) => p.id === project.id);
  if (idx >= 0) all[idx] = project;
  else all.unshift(project);
  writeAll(all);
  return project;
}

export function deleteProjectLocal(id: string): void {
  writeAll(readAll().filter((p) => p.id !== id));
}
