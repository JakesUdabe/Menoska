import { isSupabaseConfigured, createClient } from "@/lib/supabase/client";
import { DEFAULT_TEMPLATES } from "./defaults";
import {
  getReportTemplate as getLocal,
  listReportTemplates as listLocal,
  resetReportTemplate as resetLocal,
  saveReportTemplate as saveLocal,
} from "./templates-store";
import { reportTemplateSchema, type ReportKind, type ReportTemplate } from "./types";

type TemplateRow = {
  id: string;
  kind: ReportKind;
  name: string;
  description: string;
  cuestionario_schema: unknown;
  plantilla_schema: unknown;
  updated_at: string;
};

function mapRow(row: TemplateRow): ReportTemplate | null {
  const plantilla =
    row.plantilla_schema && typeof row.plantilla_schema === "object"
      ? (row.plantilla_schema as { secciones?: unknown })
      : { secciones: [] };
  const parsed = reportTemplateSchema.safeParse({
    id: row.id,
    kind: row.kind,
    name: row.name,
    description: row.description ?? "",
    cuestionario: Array.isArray(row.cuestionario_schema) ? row.cuestionario_schema : [],
    secciones: Array.isArray(plantilla.secciones) ? plantilla.secciones : [],
    updatedAt: row.updated_at,
  });
  return parsed.success ? parsed.data : null;
}

function toRow(template: ReportTemplate) {
  return {
    id: template.id,
    kind: template.kind,
    name: template.name,
    description: template.description,
    cuestionario_schema: template.cuestionario,
    plantilla_schema: { secciones: template.secciones },
    updated_at: template.updatedAt,
  };
}

function mergeWithDefaults(rows: ReportTemplate[]): ReportTemplate[] {
  const byKind = new Map(rows.map((t) => [t.kind, t]));
  return (Object.values(DEFAULT_TEMPLATES) as ReportTemplate[]).map(
    (fallback) => byKind.get(fallback.kind) ?? structuredClone(fallback),
  );
}

async function seedDefaultsIfEmpty(): Promise<ReportTemplate[]> {
  const defaults = (Object.values(DEFAULT_TEMPLATES) as ReportTemplate[]).map((t) =>
    structuredClone(t),
  );
  const supabase = createClient();
  const { error } = await supabase.from("mc_report_templates").upsert(
    defaults.map(toRow),
    { onConflict: "kind" },
  );
  if (error) {
    console.warn("mc_report_templates seed failed", error.message);
    return listLocal();
  }
  return defaults;
}

export async function listReportTemplates(): Promise<ReportTemplate[]> {
  if (!isSupabaseConfigured()) {
    return listLocal();
  }
  const supabase = createClient();
  const { data, error } = await supabase.from("mc_report_templates").select("*");
  if (error) {
    console.warn("mc_report_templates list failed", error.message);
    return listLocal();
  }
  const rows = (data as TemplateRow[] | null) ?? [];
  if (rows.length === 0) {
    return seedDefaultsIfEmpty();
  }
  const mapped = rows.map(mapRow).filter((t): t is ReportTemplate => Boolean(t));
  return mergeWithDefaults(mapped);
}

export async function getReportTemplate(kind: ReportKind): Promise<ReportTemplate> {
  if (!isSupabaseConfigured()) {
    return getLocal(kind);
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("mc_report_templates")
    .select("*")
    .eq("kind", kind)
    .maybeSingle();
  if (error) {
    console.warn("mc_report_templates get failed", error.message);
    return getLocal(kind);
  }
  if (!data) {
    const seeded = await seedDefaultsIfEmpty();
    return seeded.find((t) => t.kind === kind) ?? structuredClone(DEFAULT_TEMPLATES[kind]);
  }
  return mapRow(data as TemplateRow) ?? structuredClone(DEFAULT_TEMPLATES[kind]);
}

export async function saveReportTemplate(template: ReportTemplate): Promise<ReportTemplate> {
  const next: ReportTemplate = {
    ...reportTemplateSchema.parse(template),
    updatedAt: new Date().toISOString(),
  };
  if (!isSupabaseConfigured()) {
    return saveLocal(next);
  }
  const supabase = createClient();
  const { error } = await supabase.from("mc_report_templates").upsert(toRow(next), {
    onConflict: "kind",
  });
  if (error) {
    console.warn("mc_report_templates upsert failed", error.message);
    return saveLocal(next);
  }
  try {
    saveLocal(next);
  } catch {
    /* ignore */
  }
  return next;
}

export async function resetReportTemplate(kind: ReportKind): Promise<ReportTemplate> {
  const fresh = structuredClone(DEFAULT_TEMPLATES[kind]);
  fresh.updatedAt = new Date().toISOString();
  if (!isSupabaseConfigured()) {
    return resetLocal(kind);
  }
  return saveReportTemplate(fresh);
}
