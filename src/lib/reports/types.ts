import { z } from "zod";

export const REPORT_KINDS = ["estado_arte", "informe_mercado", "social_listening"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const MODEL_TIERS = ["sencilla", "media", "compleja"] as const;
export type ModelTier = (typeof MODEL_TIERS)[number];

export const REPORT_RESOURCES = [
  "noticias",
  "patentes",
  "articulos",
  "mercado",
  "redes_sociales",
  "voc",
] as const;
export type ReportResource = (typeof REPORT_RESOURCES)[number];

export const FIELD_TYPES = ["texto", "textarea", "numero"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const SOCIAL_PLATFORMS = ["web", "noticias", "linkedin", "foros", "reseñas"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const questionnaireFieldSchema = z.object({
  id: z.string().min(1),
  titulo: z.string().min(1),
  tipo: z.enum(FIELD_TYPES).default("textarea"),
  descripcion: z.string().default(""),
  obligatorio: z.boolean().default(true),
});

export const plantillaPromptSchema = z.object({
  id: z.string().min(1),
  titulo: z.string().min(1),
  preguntaIds: z.array(z.string()).default([]),
  recursos: z.array(z.enum(REPORT_RESOURCES)).default([]),
  prompt: z.string().min(1),
  modelo: z.enum(MODEL_TIERS).default("media"),
});

export const plantillaSeccionSchema = z.object({
  id: z.string().min(1),
  titulo: z.string().min(1),
  prompts: z.array(plantillaPromptSchema).min(1),
});

export const reportTemplateSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(REPORT_KINDS),
  name: z.string().min(1),
  description: z.string().default(""),
  cuestionario: z.array(questionnaireFieldSchema).default([]),
  secciones: z.array(plantillaSeccionSchema).default([]),
  updatedAt: z.string(),
});

export type QuestionnaireField = z.infer<typeof questionnaireFieldSchema>;
export type PlantillaPrompt = z.infer<typeof plantillaPromptSchema>;
export type PlantillaSeccion = z.infer<typeof plantillaSeccionSchema>;
export type ReportTemplate = z.infer<typeof reportTemplateSchema>;

export type ReportStatus = "draft" | "generating" | "ready" | "failed";

export type StoredReport = {
  id: string;
  kind: ReportKind;
  templateId: string;
  createdBy: string;
  organizationId: string;
  title: string;
  answers: Record<string, string>;
  markdown: string;
  sources: Array<{ source: string; title: string; snippet: string; url?: string }>;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
};

export const KIND_PATH: Record<ReportKind, string> = {
  estado_arte: "/dashboard/estado-del-arte",
  informe_mercado: "/dashboard/informe-mercado",
  social_listening: "/dashboard/social-listening",
};

export function blankQuestion(id: string): QuestionnaireField {
  return { id, titulo: "", tipo: "textarea", descripcion: "", obligatorio: true };
}

export function blankPrompt(id: string): PlantillaPrompt {
  return {
    id,
    titulo: "",
    preguntaIds: [],
    recursos: [],
    prompt: "",
    modelo: "media",
  };
}

export function blankSection(id: string, promptId: string): PlantillaSeccion {
  return { id, titulo: "", prompts: [blankPrompt(promptId)] };
}

export function nextPrefixedId(prefix: string, existing: string[]): string {
  const re = new RegExp(`^${prefix}(\\d+)$`);
  const nums = existing
    .map((id) => {
      const m = id.match(re);
      return m ? Number(m[1]) : 0;
    })
    .filter((n) => n > 0);
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `${prefix}${max + 1}`;
}
