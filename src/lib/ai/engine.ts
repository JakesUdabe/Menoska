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
  if (!anthropic && !gemini) return parseNlQueryFallback(query);

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
  const spec = MODEL_BY_COMPLEXITY[input.complexity ?? "media"];
  if (!anthropic && !gemini) return null;

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
  const header = headerImgUrl
    ? `<tr><td align="center" style="padding:0;"><img src="${headerImgUrl}" alt="ABI News" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;" /></td></tr>`
    : `<tr><td align="center" style="padding:24px 24px 8px;font-family:Georgia,serif;font-size:22px;color:#16324f;">ABI News</td></tr>`;

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="${locale}">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ABI News</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fa;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fa;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;">
          ${header}
          ${innerRows}
          <tr>
            <td style="padding:20px 24px 28px;font-family:Arial,sans-serif;font-size:11px;color:#6b7c8a;">
              ABI News · Vigilancia tecnológica
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
