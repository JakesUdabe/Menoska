import { renderMenoskaEmail } from "@/lib/email/layout";
import type { Locale } from "@/i18n/locales";
import type { BulletinSectionCriteria } from "@/lib/and-filter";

export type AiEngineInput = {
  locale: Locale;
  sections: Array<BulletinSectionCriteria & { title: string }>;
  history: Array<{ url: string; title: string }>;
  maxItems: number;
  headerImgUrl?: string;
};

export function buildBulletinPrompt(input: AiEngineInput): string {
  const config = {
    IDIOMA_BOLETIN: input.locale,
    JSON_SECCIONES_CONFIG: input.sections,
    HISTORIAL_DUPLICADOS_JSON: input.history,
    MAX_ITEMS: input.maxItems,
    HEADER_IMG_URL: input.headerImgUrl ?? "",
  };

  return `ROL: Actúa como un Analista de Noticias Tecnológicas, especialista en vigilancia de patentes y Desarrollador de Email Marketing experto. Tu objetivo es buscar, filtrar y maquetar autónomamente un boletín HTML multilingüe.

CONTEXTO:
${JSON.stringify(config, null, 2)}

FASE 1: BÚSQUEDA (ÚLTIMOS 7 DÍAS) + FILTRO AND OBLIGATORIO
1. Para cada sección en JSON_SECCIONES_CONFIG, rastrea noticias (sitios oficiales y prensa) y patentes (Lens.org; EPO como respaldo).
2. REGLA CRÍTICA (AND): un ítem SOLO entra si menciona al menos UNA empresa de interés Y al menos UNA tecnología/keyword de esa sección. Si habla solo de la empresa o solo de la tecnología, DESCÁRTALO.
3. Prioriza impacto e innovación. Máximo ${input.maxItems} ítems por boletín.

FASE 2: ANTI-DUPLICIDAD
Contrasta URL y título contra HISTORIAL_DUPLICADOS_JSON. Si hay misma URL o similitud semántica >85% en el título, sustituye por la siguiente novedad.

FASE 3: PROCESAMIENTO
Por cada ítem: titular (máx. 12 palabras) en ${input.locale}; resumen 2-3 frases con <b> en conceptos clave; metadatos (empresa/solicitante, IPC, fecha); URL origen e imagen.

FASE 4: HTML EMAIL-SAFE
Tablas HTML (Outlook/Gmail/Apple Mail). Cabecera {{HEADER_IMG_URL}}. CERO citas [1]/[cite]. Idioma estricto ${input.locale}. Devuelve ÚNICAMENTE el HTML completo.`;
}

export type NlParseResult = {
  companies: string[];
  competitors: string[];
  technologies: string[];
  rationale: string;
};

export function parseNlQueryFallback(query: string): NlParseResult {
  const words = query.split(/\s+/).filter(Boolean);
  const proper = Array.from(
    query.matchAll(/\b([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚáéíóúñ&-]{2,}(?:\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚáéíóúñ&-]{2,})*)\b/g),
  ).map((m) => m[1]);
  const techHints = words.filter((w) => w.length > 6).slice(0, 8);
  return {
    companies: proper.slice(0, 4),
    competitors: proper.slice(4, 7),
    technologies: techHints,
    rationale:
      "Extracción local a partir del texto. Conecta las claves de proceso para un análisis más completo.",
  };
}

export async function parseNlQueryWithLlm(query: string): Promise<NlParseResult> {
  const anthropic = process.env.ANTHROPIC_API_KEY;
  const gemini = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const openai = process.env.OPENAI_API_KEY;
  if (!anthropic && !gemini && !openai) return parseNlQueryFallback(query);

  const system =
    'Extrae JSON con claves companies, competitors, technologies (arrays de strings) y rationale. Sin markdown.';
  const user = `Consulta del usuario (>=15 palabras): ${query}`;

  if (anthropic) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anthropic,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 800,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) return parseNlQueryFallback(query);
    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    return coerceNl(data.content?.[0]?.text);
  }

  if (openai) {
    const text = await completeOpenAi(system, user, 800);
    return coerceNl(text ?? undefined);
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${gemini}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${system}\n${user}` }] }],
      }),
    },
  );
  if (!res.ok) return parseNlQueryFallback(query);
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return coerceNl(data.candidates?.[0]?.content?.parts?.[0]?.text);
}

export type LlmComplexity = "sencilla" | "media" | "compleja";

const MODEL_BY_COMPLEXITY: Record<LlmComplexity, { anthropic: string; gemini: string; maxTokens: number }> = {
  sencilla: { anthropic: "claude-sonnet-4-5", gemini: "gemini-2.0-flash", maxTokens: 1200 },
  media: { anthropic: "claude-sonnet-4-5", gemini: "gemini-2.0-flash", maxTokens: 2500 },
  compleja: { anthropic: "claude-sonnet-4-5", gemini: "gemini-2.0-flash", maxTokens: 4000 },
};

export async function completeWithLlm(input: {
  system: string;
  user: string;
  complexity?: LlmComplexity;
}): Promise<string | null> {
  const anthropic = process.env.ANTHROPIC_API_KEY;
  const gemini = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const openai = process.env.OPENAI_API_KEY;
  const spec = MODEL_BY_COMPLEXITY[input.complexity ?? "media"];
  if (!anthropic && !gemini && !openai) return null;

  if (anthropic) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anthropic,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: spec.anthropic,
        max_tokens: spec.maxTokens,
        system: input.system,
        messages: [{ role: "user", content: input.user }],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    return data.content?.[0]?.text?.trim() || null;
  }

  if (openai) return completeOpenAi(input.system, input.user, spec.maxTokens);

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${spec.gemini}:generateContent?key=${gemini}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${input.system}\n\n${input.user}` }] }],
        generationConfig: { maxOutputTokens: spec.maxTokens },
      }),
    },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
}

async function completeOpenAi(system: string, user: string, maxTokens: number): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content?.trim() || null;
}

function coerceNl(raw?: string): NlParseResult {
  if (!raw) return parseNlQueryFallback("");
  try {
    const jsonStart = raw.indexOf("{");
    const jsonEnd = raw.lastIndexOf("}");
    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as NlParseResult;
    return {
      companies: parsed.companies ?? [],
      competitors: parsed.competitors ?? [],
      technologies: parsed.technologies ?? [],
      rationale: parsed.rationale ?? "",
    };
  } catch {
    return parseNlQueryFallback(raw);
  }
}

export function wrapEmailHtml(innerRows: string, locale: Locale, headerImgUrl?: string): string {
  const image = headerImgUrl
    ? `<img src="${headerImgUrl}" alt="Menoska Consulting" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;margin:0 0 16px;" />`
    : "";
  return renderMenoskaEmail({
    lang: locale,
    preheader: "Menoska Consulting",
    innerHtml: `${image}${innerRows}`,
  });
}
