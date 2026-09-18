import type { ReportKind, StoredReport } from "./types";

const KEY = "abi_intelligence_reports";

function readAll(): StoredReport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredReport[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(items: StoredReport[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function listReportsForUser(
  userId: string,
  organizationId: string | null,
  seeOrg: boolean,
  kind?: ReportKind,
): StoredReport[] {
  return readAll()
    .filter((r) => {
      if (kind && r.kind !== kind) return false;
      if (seeOrg && organizationId) return r.organizationId === organizationId;
      return r.createdBy === userId;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getReport(id: string): StoredReport | undefined {
  return readAll().find((r) => r.id === id);
}

export function upsertReport(report: StoredReport): StoredReport {
  const items = readAll();
  const idx = items.findIndex((r) => r.id === report.id);
  const next = { ...report, updatedAt: new Date().toISOString() };
  if (idx >= 0) items[idx] = next;
  else items.unshift(next);
  persist(items);
  return next;
}

export function deleteReport(id: string) {
  persist(readAll().filter((r) => r.id !== id));
}

export function newReportId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `rep-${Date.now()}`;
}
