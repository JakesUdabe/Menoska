import { completeWithLlm } from "@/lib/ai/engine";
import { searchPatents } from "@/lib/patents/lens";
import { gatherSocialEvidence, splitLines, type SocialEvidence } from "./social-research";
import type { ReportKind, ReportTemplate } from "./types";

function answersForPrompt(template: ReportTemplate, promptId: string, answers: Record<string, string>) {
  const prompt = template.secciones.flatMap((s) => s.prompts).find((p) => p.id === promptId);
  const ids = prompt?.preguntaIds?.length ? prompt.preguntaIds : template.cuestionario.map((q) => q.id);
  return ids
    .map((id) => {
      const field = template.cuestionario.find((q) => q.id === id);
      const value = (answers[id] ?? "").trim();
      if (!field || !value) return null;
      return `${field.titulo}: ${value}`;
    })
    .filter(Boolean)
    .join("\n");
}

function fallbackSection(title: string, prompt: string, linked: string, evidence: SocialEvidence[]) {
  const sources =
    evidence.length > 0
      ? evidence.map((e) => `- ${e.title}: ${e.snippet}`).join("\n")
      : "- Sin fuentes externas (modo demostración o APIs no configuradas).";
  return `## ${title}\n\n${prompt}\n\n**Entrada del cliente**\n${linked || "Sin respuestas vinculadas."}\n\n**Evidencia**\n${sources}\n`;
}

export async function generateReportMarkdown(input: {
  kind: ReportKind;
  template: ReportTemplate;
  answers: Record<string, string>;
}): Promise<{ markdown: string; sources: SocialEvidence[] }> {
  const wantsPatents =
    input.kind === "estado_arte" ||
    input.template.secciones.some((section) => section.prompts.some((prompt) => prompt.recursos.includes("patentes")));
  const patentQuery = [input.answers.tema, input.answers.sector, input.answers.actores, input.answers.preguntas]
    .map((value) => (value ?? "").trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, 240);
  const patents = wantsPatents && patentQuery ? await searchPatents(patentQuery, 6) : [];
  const patentEvidence: SocialEvidence[] = patents.map((patent) => ({
    source: "patentes",
    title: `${patent.id} ${patent.title}`.trim(),
    url: patent.url,
    snippet: [
      patent.legalStatus ? `Estado legal: ${patent.legalStatus}` : "",
      patent.applicants.length ? `Solicitante: ${patent.applicants.join(", ")}` : "",
      patent.ipc.length ? `IPC: ${patent.ipc.join(", ")}` : "",
      patent.abstract,
      patent.claims?.[0] ? `Reivindicación: ${patent.claims[0].slice(0, 500)}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  }));

  const sources = [
    ...(input.kind === "social_listening" ||
    input.template.secciones.some((s) => s.prompts.some((p) => p.recursos.includes("redes_sociales") || p.recursos.includes("voc")))
      ? await gatherSocialEvidence({
          brands: splitLines(input.answers.marcas ?? input.answers.tema ?? input.answers.mercado),
          keywords: splitLines(input.answers.keywords ?? input.answers.preguntas ?? input.answers.segmentos),
          platforms: splitLines(input.answers.plataformas),
          period: input.answers.periodo ?? input.answers.horizonte ?? "",
          language: input.answers.idioma,
        })
      : []),
    ...patentEvidence,
  ];

  const evidenceText = sources
    .map((e) => `[${e.source}] ${e.title}${e.url ? ` (${e.url})` : ""}\n${e.snippet}`)
    .join("\n\n");

  const parts: string[] = [
    `# ${input.template.name}`,
    "",
    `Generado a partir de la plantilla «${input.template.name}».`,
    "",
  ];

  for (const section of input.template.secciones) {
    parts.push(`# ${section.titulo}`, "");
    for (const prompt of section.prompts) {
      const linked = answersForPrompt(input.template, prompt.id, input.answers);
      const system =
        "Eres analista de vigilancia tecnológica e inteligencia competitiva. Redactas informes profesionales en el idioma de las respuestas del cliente. No inventes cifras, URLs ni citas. Si falta evidencia, dilo.";
      const user = [
        `Sección: ${section.titulo} › ${prompt.titulo}`,
        `Instrucciones:\n${prompt.prompt}`,
        linked ? `Respuestas del cliente:\n${linked}` : "Sin respuestas vinculadas.",
        evidenceText ? `Fuentes / evidencia:\n${evidenceText}` : "Sin evidencia externa.",
        "Devuelve solo el cuerpo de la sección en Markdown (sin el título H1 del informe).",
      ].join("\n\n");

      const generated = await completeWithLlm({
        system,
        user,
        complexity: prompt.modelo,
      });
      parts.push(generated || fallbackSection(prompt.titulo || section.titulo, prompt.prompt, linked, sources));
      parts.push("");
    }
  }

  return { markdown: parts.join("\n").trim(), sources };
}
