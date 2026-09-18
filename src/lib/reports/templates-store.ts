import { DEFAULT_TEMPLATES } from "./defaults";
import { reportTemplateSchema, type ReportKind, type ReportTemplate } from "./types";

const KEY = "abi_report_templates";

function cloneDefaults(): ReportTemplate[] {
  return (Object.values(DEFAULT_TEMPLATES) as ReportTemplate[]).map((tpl) =>
    structuredClone(tpl),
  );
}

function readAll(): ReportTemplate[] {
  if (typeof window === "undefined") return cloneDefaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return cloneDefaults();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return cloneDefaults();
    const byKind = new Map<ReportKind, ReportTemplate>();
    for (const item of parsed) {
      const result = reportTemplateSchema.safeParse(item);
      if (result.success) byKind.set(result.data.kind, result.data);
    }
    return cloneDefaults().map((fallback) => byKind.get(fallback.kind) ?? fallback);
  } catch {
    return cloneDefaults();
  }
}

function persist(items: ReportTemplate[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function listReportTemplates(): ReportTemplate[] {
  return readAll();
}

export function getReportTemplate(kind: ReportKind): ReportTemplate {
  return readAll().find((t) => t.kind === kind) ?? structuredClone(DEFAULT_TEMPLATES[kind]);
}

export function saveReportTemplate(template: ReportTemplate): ReportTemplate {
  const next: ReportTemplate = {
    ...reportTemplateSchema.parse(template),
    updatedAt: new Date().toISOString(),
  };
  const items = readAll().map((t) => (t.kind === next.kind ? next : t));
  persist(items);
  return next;
}

export function resetReportTemplate(kind: ReportKind): ReportTemplate {
  const fresh = structuredClone(DEFAULT_TEMPLATES[kind]);
  fresh.updatedAt = new Date().toISOString();
  const items = readAll().map((t) => (t.kind === kind ? fresh : t));
  persist(items);
  return fresh;
}
