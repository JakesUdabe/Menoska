import { conceptsIn, fold } from "./concepts";
import type { ProductCorpus, SearchContext, TechnicalRdf } from "./rdf";
import { buildSearchContexts, productCorpus } from "./rdf";

export type ElementVerdict = "presente" | "parcial" | "ausente" | "fuera";
export type ClaimReading = "lectura_potencial" | "elemento_ausente" | "alejada";
export type ClaimKind = "independiente" | "dependiente" | "proxy";
export type ClaimSource = "register" | "demo" | "abstract";
export type FtoRisk = "Alto" | "Medio" | "Bajo";

export type ClaimElement = {
  text: string;
  verdict: ElementVerdict;
  concepts: string[];
};

export type ComparedClaim = {
  index: number;
  kind: ClaimKind;
  source: ClaimSource;
  text: string;
  elements: ClaimElement[];
  reading: ClaimReading;
};

export type ComparedPatent = {
  id: string;
  title: string;
  assignee: string;
  year: string;
  url: string;
  ipc: string[];
  closeness: number;
  afterCutoff: boolean;
  legalStatus?: "alive" | "dead" | "pending" | "unknown";
  claims: ComparedClaim[];
};

export type FtoPatentInput = {
  id: string;
  title: string;
  abstract: string;
  url: string;
  applicants: string[];
  ipc: string[];
  publishedAt: string;
  claims: string[];
  claimSource: ClaimSource;
  legalStatus?: "alive" | "dead" | "pending" | "unknown";
};

export type FtoReport = {
  disclaimer: string;
  contexts: SearchContext[];
  risk: FtoRisk;
  riskScore: number;
  patents: ComparedPatent[];
};

export const FTO_DISCLAIMER =
  "Cribado técnico de libertad de explotación. Aplica la regla de todos los elementos sobre el RDF y no sustituye una opinión legal ni el texto oficial de las reivindicaciones.";

const DEPENDENT =
  /\b(according to claim|segun la reivindicacion|de acuerdo con la reivindicacion)\b|\b(claim|reivindicacion)\s+\d+\b/i;

export function splitClaimElements(claim: string): string[] {
  const body = claim.replace(/^\s*\d+\s*[.)]\s*/, "").trim();
  const parts = body
    .split(
      /\s*;\s*|\s+(?:wherein|characterized in that|characterised in that|en el que|caracterizado por que|caracterizado porque)\s+/i,
    )
    .map((part) => part.trim())
    .filter((part) => part.length >= 15);
  return parts.length ? parts : body ? [body] : [];
}

export function claimKind(claim: string, source: ClaimSource): ClaimKind {
  if (source === "abstract") return "proxy";
  return DEPENDENT.test(fold(claim)) ? "dependiente" : "independiente";
}

function elementVerdict(text: string, corpus: ProductCorpus): ClaimElement {
  const concepts = [...conceptsIn(text)];
  if (!concepts.length) return { text, verdict: "ausente", concepts };
  let support = 0;
  let contra = 0;
  for (const id of concepts) {
    if (corpus.positive.has(id)) support += 1;
    else if (corpus.negative.has(id)) contra += 1;
  }
  const total = concepts.length;
  let verdict: ElementVerdict = "ausente";
  if (contra > 0 && contra >= support) verdict = "fuera";
  else if (support === total) verdict = "presente";
  else if (contra === 0 && support / total >= 0.5) verdict = "parcial";
  else if (contra > 0 && support > contra) verdict = "parcial";
  return { text, verdict, concepts };
}

function readingOf(elements: ClaimElement[]): ClaimReading {
  if (!elements.length) return "alejada";
  if (elements.every((element) => element.verdict === "presente")) return "lectura_potencial";
  if (elements.some((element) => element.verdict === "presente" || element.verdict === "parcial")) {
    return "elemento_ausente";
  }
  return "alejada";
}

export function closenessScore(rdf: TechnicalRdf, patent: FtoPatentInput, corpus = productCorpus(rdf)): number {
  const doc = conceptsIn(`${patent.title}\n${patent.abstract}\n${patent.claims.join("\n")}`);
  if (!corpus.positive.size) return 0;
  let support = 0;
  for (const id of corpus.positive) if (doc.has(id)) support += 1;
  let contra = 0;
  for (const id of corpus.negative) if (doc.has(id)) contra += 1;
  const ipc = rdf.ipc.trim().slice(0, 4);
  const classBonus =
    ipc.length >= 3 && patent.ipc.some((symbol) => fold(symbol).startsWith(fold(ipc))) ? 0.08 : 0;
  const raw = support / corpus.positive.size - 0.2 * (contra / Math.max(1, corpus.negative.size)) + classBonus;
  return Math.max(0, Math.min(1, raw));
}

function compareClaim(claim: string, index: number, source: ClaimSource, corpus: ProductCorpus): ComparedClaim {
  const elements = splitClaimElements(claim).map((text) => elementVerdict(text, corpus));
  return {
    index,
    kind: claimKind(claim, source),
    source,
    text: claim,
    elements,
    reading: readingOf(elements),
  };
}

export function screenFto(rdf: TechnicalRdf, inputs: FtoPatentInput[]): FtoReport {
  const corpus = productCorpus(rdf);
  const contexts = buildSearchContexts(rdf);
  const ranked = inputs
    .map((patent) => {
      const claims = patent.claims.map((claim, index) => compareClaim(claim, index + 1, patent.claimSource, corpus));
      const afterCutoff = Boolean(rdf.cutoff.trim() && patent.publishedAt && patent.publishedAt > rdf.cutoff.trim());
      const closeness = closenessScore(rdf, patent, corpus) * (afterCutoff ? 0.85 : 1);
      return {
        id: patent.id,
        title: patent.title,
        assignee: patent.applicants[0] ?? "—",
        year: patent.publishedAt.slice(0, 4),
        url: patent.url,
        ipc: patent.ipc,
        closeness,
        afterCutoff,
        legalStatus: patent.legalStatus,
        claims,
      } satisfies ComparedPatent;
    })
    .sort((a, b) => b.closeness - a.closeness)
    .slice(0, 4);

  const governsRisk = ranked.flatMap((patent) =>
    patent.claims.filter(
      (claim) => claim.kind !== "dependiente" && claim.source !== "abstract" && claim.elements.length > 0,
    ),
  );
  let risk: FtoRisk = "Bajo";
  if (governsRisk.some((claim) => claim.reading === "lectura_potencial")) risk = "Alto";
  else if (governsRisk.some((claim) => claim.reading === "elemento_ausente")) risk = "Medio";

  const top = ranked[0]?.closeness ?? 0;
  let riskScore = Math.round(top * 100);
  if (risk === "Alto") riskScore = Math.max(riskScore, 70);
  if (risk === "Bajo") riskScore = Math.min(riskScore, 35);

  return { disclaimer: FTO_DISCLAIMER, contexts, risk, riskScore, patents: ranked };
}
