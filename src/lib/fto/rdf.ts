import { conceptsIn, distinctiveWords, SEARCH_PHRASE } from "./concepts";

export const COMMERCIAL_ACTS = ["fabricar", "usar", "ofrecer", "vender", "importar"] as const;
export type CommercialAct = (typeof COMMERCIAL_ACTS)[number];

export const RDF_LIMITS = {
  productName: 12,
  commercialDetail: 80,
  jurisdictions: 5,
  cutoff: 8,
  technicalProblem: 280,
  technicalEffect: 160,
  embodiment: 480,
  essentialFeatures: 400,
  materialsParameters: 180,
  exclusions: 180,
  variants: 140,
  vocabulary: 60,
  ipc: 3,
} as const;

export type RdfField = keyof typeof RDF_LIMITS;

export type TechnicalRdf = {
  productName: string;
  commercialActs: CommercialAct[];
  commercialDetail: string;
  jurisdictions: string;
  cutoff: string;
  technicalProblem: string;
  technicalEffect: string;
  embodiment: string;
  /** One essential feature per line. Lines that start with a negation count as exclusions. */
  essentialFeatures: string;
  materialsParameters: string;
  exclusions: string;
  variants: string;
  vocabulary: string;
  ipc: string;
  knownPatents: string;
};

export type RdfGap = { field: RdfField | "commercialActs"; have: number; min: number };

const NEGATION =
  /^(no\b|sin\b|ausencia\b|carece\b|exento\b|without\b|not\b|does not\b|libre de\b|tampoco\b|ningun[oa]?\b)/i;

export function isNegatedLine(line: string): boolean {
  return NEGATION.test(line.trim());
}

function proseChunks(text: string): string[] {
  return text
    .split(/\n+|(?<=[.!;])\s+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

export function featureLines(rdf: Pick<TechnicalRdf, "essentialFeatures">): string[] {
  return rdf.essentialFeatures
    .split(/\n+/)
    .map((line) => line.replace(/^[\s\-*\d\.\)\(]+/, "").trim())
    .filter((line) => line.length >= 8);
}

export function validateRdf(rdf: TechnicalRdf): { ok: true } | { ok: false; gaps: RdfGap[] } {
  const gaps: RdfGap[] = [];
  (Object.keys(RDF_LIMITS) as RdfField[]).forEach((field) => {
    const have = rdf[field].trim().length;
    const min = RDF_LIMITS[field];
    if (have < min) gaps.push({ field, have, min });
  });
  if (rdf.commercialActs.length < 1) gaps.push({ field: "commercialActs", have: 0, min: 1 });
  return gaps.length ? { ok: false, gaps } : { ok: true };
}

export type ProductCorpus = {
  positive: Set<string>;
  negative: Set<string>;
  positiveText: string;
  negativeText: string;
};

export function productCorpus(rdf: TechnicalRdf): ProductCorpus {
  const positiveParts: string[] = [rdf.productName];
  const negativeParts: string[] = [];
  const absorb = (text: string, forceNegative = false) => {
    if (forceNegative) {
      negativeParts.push(text);
      return;
    }
    for (const chunk of proseChunks(text)) {
      if (isNegatedLine(chunk)) negativeParts.push(chunk);
      else positiveParts.push(chunk);
    }
  };
  absorb(rdf.technicalProblem);
  absorb(rdf.technicalEffect);
  absorb(rdf.embodiment);
  absorb(rdf.materialsParameters);
  absorb(rdf.variants);
  for (const line of featureLines(rdf)) absorb(line);
  absorb(rdf.exclusions, true);
  const positiveText = positiveParts.join("\n");
  const negativeText = negativeParts.join("\n");
  const positive = conceptsIn(positiveText);
  const negative = conceptsIn(negativeText);
  for (const id of positive) negative.delete(id);
  return { positive, negative, positiveText, negativeText };
}

export type SearchContext = { id: string; label: string; query: string };

export function buildSearchContexts(rdf: TechnicalRdf): SearchContext[] {
  const { positive } = productCorpus(rdf);
  const conceptQuery = [...positive]
    .slice(0, 6)
    .map((id) => SEARCH_PHRASE[id] ?? id)
    .join(" ");
  const problem = distinctiveWords(rdf.technicalProblem, 6).join(" ");
  const vocab = distinctiveWords(`${rdf.vocabulary} ${rdf.productName} ${rdf.knownPatents}`, 8).join(" ");
  const contexts: SearchContext[] = [
    { id: "elements", label: "Elementos del producto", query: conceptQuery },
    { id: "problem", label: "Problema técnico", query: `${rdf.ipc.trim()} ${problem}`.trim() },
    { id: "vocabulary", label: "Vocabulario y arte conocido", query: vocab },
  ];
  return contexts.filter((context) => context.query.trim().length >= 3);
}

export function coerceRdf(value: unknown, fallback: TechnicalRdf): TechnicalRdf {
  if (!value || typeof value !== "object") return fallback;
  const raw = value as Partial<TechnicalRdf>;
  if (typeof raw.essentialFeatures !== "string" || typeof raw.embodiment !== "string") return fallback;
  const acts = Array.isArray(raw.commercialActs)
    ? raw.commercialActs.filter((act): act is CommercialAct =>
        (COMMERCIAL_ACTS as readonly string[]).includes(act),
      )
    : fallback.commercialActs;
  const text = (key: RdfField | "knownPatents", current: string) =>
    typeof raw[key] === "string" ? (raw[key] as string) : current;
  return {
    productName: text("productName", fallback.productName),
    commercialActs: acts.length ? acts : fallback.commercialActs,
    commercialDetail: text("commercialDetail", fallback.commercialDetail),
    jurisdictions: text("jurisdictions", fallback.jurisdictions),
    cutoff: text("cutoff", fallback.cutoff),
    technicalProblem: text("technicalProblem", fallback.technicalProblem),
    technicalEffect: text("technicalEffect", fallback.technicalEffect),
    embodiment: text("embodiment", fallback.embodiment),
    essentialFeatures: raw.essentialFeatures,
    materialsParameters: text("materialsParameters", fallback.materialsParameters),
    exclusions: text("exclusions", fallback.exclusions),
    variants: text("variants", fallback.variants),
    vocabulary: text("vocabulary", fallback.vocabulary),
    ipc: text("ipc", fallback.ipc),
    knownPatents: text("knownPatents", fallback.knownPatents),
  };
}
