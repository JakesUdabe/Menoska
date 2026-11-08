import type { ReportKind, StoredReport } from "./types";
import { readMigratedStorage, writeStorage } from "@/lib/storage-keys";
import { SHOWCASE_CASE, SHOWCASE_MARKET_ID, SHOWCASE_PATENTS, SHOWCASE_SOTA_ID, formatEur, showcaseSam, showcaseSom } from "@/lib/showcase-case";

const KEY = "menoska_intelligence_reports";
const OLD_KEY = "abi_intelligence_reports";

function showcaseReports(): StoredReport[] {
  const now = "2026-10-20T08:00:00.000Z";
  const sam = showcaseSam(SHOWCASE_CASE);
  const som = showcaseSom(SHOWCASE_CASE);
  const sources = SHOWCASE_PATENTS.map((patent) => ({
    source: "patent",
    title: `${patent.id} · ${patent.title}`,
    snippet: patent.body,
    url: patent.url,
  }));
  const sota: StoredReport = {
    id: SHOWCASE_SOTA_ID,
    kind: "estado_arte",
    templateId: "showcase",
    createdBy: "user-client",
    organizationId: "org-menoska",
    title: "Estado del arte · térmica de packs (Tesla, documentos públicos)",
    answers: { tecnologia: "gestión térmica de battery pack", empresa: "Tesla" },
    status: "ready",
    createdAt: now,
    updatedAt: now,
    sources,
    markdown: [
      "# Estado del arte — gestión térmica de packs de batería",
      "",
      "Documentos públicos de Tesla. Esto no es una opinión de libertad de operación.",
      "",
      ...SHOWCASE_PATENTS.map(
        (patent) =>
          `- **${patent.id}** (${patent.year}) — ${patent.title}. Riesgo de diseño literal: ${patent.risk}. ${patent.url}`,
      ),
      "",
      "## Lectura para el caso",
      "",
      "US8268469B2, US8277965B2 y US9093726B2 cubren el recinto, el escape de gas y la mitigación activa del thermal runaway. Copiar esa arquitectura choca con la familia.",
      "",
      "US8082743B2 cubre el control de temperatura. El hueco que deja la familia publicada está en licenciar o desarrollar ese control, no en rehacer el escape.",
    ].join("\n"),
  };
  const market: StoredReport = {
    id: SHOWCASE_MARKET_ID,
    kind: "informe_mercado",
    templateId: "showcase",
    createdBy: "user-client",
    organizationId: "org-menoska",
    title: "Informe de mercado · térmica de packs (cifras de planificación)",
    answers: { mercado: "gestión térmica EV" },
    status: "ready",
    createdAt: now,
    updatedAt: now,
    sources,
    markdown: [
      "# Informe de mercado — cifras de planificación",
      "",
      "Cifras de planificación para este informe. No son un estudio de terceros.",
      "",
      `- TAM ilustrativo (EU + NA): ${formatEur(SHOWCASE_CASE.tamEur)}`,
      `- Cuota geográfica UE ${SHOWCASE_CASE.geoShare}% × segmento OEM/tier-1 ${SHOWCASE_CASE.segmentShare}% → SAM ${formatEur(sam)}`,
      `- Captura ${SHOWCASE_CASE.captureShare}% → SOM ${formatEur(som)}`,
      "",
      "Encaje: partner. Un build que reproduzca el escape publicado no es el camino que sostiene el estado del arte.",
    ].join("\n"),
  };
  return [sota, market];
}

function readAll(): StoredReport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = readMigratedStorage(KEY, OLD_KEY);
    if (!raw) {
      const seeded = showcaseReports();
      persist(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as StoredReport[];
    if (!Array.isArray(parsed)) return [];
    const seeded = showcaseReports();
    const byId = new Map(parsed.map((report) => [report.id, report]));
    let changed = parsed.length !== byId.size;
    for (const report of seeded) {
      const current = byId.get(report.id);
      if (!current) {
        byId.set(report.id, report);
        changed = true;
        continue;
      }
      if (current.markdown.toLowerCase().includes("memo")) {
        byId.set(report.id, { ...current, markdown: report.markdown });
        changed = true;
      }
    }
    const next = [...byId.values()];
    if (changed) persist(next);
    return next;
  } catch {
    return [];
  }
}

function persist(items: StoredReport[]) {
  writeStorage(KEY, JSON.stringify(items));
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
