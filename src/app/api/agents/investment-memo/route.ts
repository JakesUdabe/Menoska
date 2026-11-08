import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAuthWithPlan } from "@/lib/api/plan-guard";
import { assertAiQuota, estimateTokens, extraAiFromRequest, recordAiUsage } from "@/lib/ai/usage";

const schema = z.object({
  company: z.string().min(1).max(200),
  thesis: z.string().min(1).max(4000),
  sector: z.string().max(200).optional(),
  ticketEur: z.number().positive().optional(),
  risks: z.string().max(2000).optional(),
  tamEur: z.number().nonnegative().optional(),
  geoShare: z.number().min(0).max(100).optional(),
  segmentShare: z.number().min(0).max(100).optional(),
  captureShare: z.number().min(0).max(100).optional(),
  fit: z.enum(["build", "buy", "partner"]).optional(),
  priceShockPct: z.number().min(0).max(90).optional(),
});

function eur(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

function templateMemo(input: z.infer<typeof schema>): string {
  const tam = input.tamEur;
  const sam =
    tam != null && input.geoShare != null && input.segmentShare != null
      ? tam * (input.geoShare / 100) * (input.segmentShare / 100)
      : null;
  const som = sam != null && input.captureShare != null ? sam * (input.captureShare / 100) : null;
  const fitLabel =
    input.fit === "build" ? "Build" : input.fit === "buy" ? "Buy" : input.fit === "partner" ? "Partner" : "Por definir";
  const shock = input.priceShockPct;
  const revenue = 6_000_000 * (1 - (shock ?? 0) / 100);
  const profit = revenue * (1 - 0.62) - 1_200_000;

  return `# Investment Memo (borrador)

## Empresa
${input.company}

## Sector
${input.sector ?? "N/D"}

## Tesis
${input.thesis}

## Mercado (planificación, no estudio de terceros)
- TAM: ${tam != null ? eur(tam) : "Por definir"}
- SAM: ${sam != null ? eur(sam) : "Por definir"}${input.geoShare != null ? ` (geo ${input.geoShare}% × segmento ${input.segmentShare}%)` : ""}
- SOM: ${som != null ? eur(som) : "Por definir"}${input.captureShare != null ? ` (captura ${input.captureShare}%)` : ""}

## Encaje
Recomendación de vía: **${fitLabel}**. Build solo si no reproduce las reivindicaciones de escape y mitigación activa. Buy no tiene un target nombrado en este caso. Partner es la vía que cierra el estado del arte.

## Sensibilidad
${
  shock != null
    ? `Con ingreso objetivo de 6 M€, coste variable 62% y coste fijo 1,2 M€, un −${shock}% de precio deja el resultado en ${eur(profit)}.`
    : "Sin shock de precio informado."
}

## Ticket orientativo
${input.ticketEur != null ? eur(input.ticketEur) : "Por definir"}

## Riesgos señalados
${input.risks?.trim() || "Pendiente de diligencia."}

## Recomendación (HITL)
Estado: **PENDIENTE DE APROBACIÓN HUMANA**. Este borrador no es consejo de inversión ni una opinión legal de libertad de operación.

## Fuentes
Patentes públicas citadas en el estado del arte del caso. Plantilla local si no hay clave de LLM.
`;
}

async function llmMemo(input: z.infer<typeof schema>): Promise<{ markdown: string; provider: string } | null> {
  const openai = process.env.OPENAI_API_KEY;
  const anthropic = process.env.ANTHROPIC_API_KEY;
  const prompt = `Redacta un investment memo breve (markdown, español) para: ${input.company}. Sector: ${input.sector ?? "N/D"}. Tesis: ${input.thesis}. Ticket: ${input.ticketEur ?? "N/D"} €. TAM ${input.tamEur ?? "N/D"} €, geo ${input.geoShare ?? "N/D"}%, segmento ${input.segmentShare ?? "N/D"}%, captura ${input.captureShare ?? "N/D"}%, encaje ${input.fit ?? "N/D"}, shock de precio ${input.priceShockPct ?? "N/D"}%. Riesgos: ${input.risks ?? "N/D"}. Di de forma explícita que las cifras de mercado son de planificación. Incluye secciones Tesis, Mercado, Encaje, Sensibilidad, Riesgos y Recomendación (siempre "PENDIENTE DE APROBACIÓN HUMANA"). No inventes números de patente distintos de los que vengan en la tesis.`;

  if (openai) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${openai}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        messages: [
          { role: "system", content: "Eres analista de venture/growth EU. Sé concreto y cauto." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content;
      if (content) return { markdown: content, provider: "openai" };
    }
  }

  if (anthropic) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anthropic,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? "claude-3-5-haiku-latest",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { content?: Array<{ text?: string }> };
      const content = data.content?.[0]?.text;
      if (content) return { markdown: content, provider: "anthropic" };
    }
  }

  return null;
}

export async function POST(request: Request) {
  const auth = await requireApiAuthWithPlan(request, "investment-memo");
  if (!auth.ok) return auth.response;

  const quota = await assertAiQuota({
    userId: auth.userId,
    organizationId: auth.organizationId,
    plan: auth.plan,
    extraAi: extraAiFromRequest(request),
  });
  if (quota) return quota;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  let markdown = templateMemo(parsed.data);
  let provider = "template";
  try {
    const llm = await llmMemo(parsed.data);
    if (llm) {
      markdown = llm.markdown;
      provider = llm.provider;
    }
  } catch {
    /* keep template */
  }

  await recordAiUsage({
    userId: auth.userId,
    organizationId: auth.organizationId,
    kind: "investment_memo",
    tokensIn: estimateTokens(JSON.stringify(parsed.data)),
    tokensOut: estimateTokens(markdown),
    meta: { provider, demo: auth.demo },
  });

  return NextResponse.json({
    ok: true,
    provider,
    status: "pending_approval",
    markdown,
    hitlRequired: true,
  });
}
