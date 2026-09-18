export type BulletinSectionCriteria = {
  companies: string[];
  competitors: string[];
  technologies: string[];
};

export type CandidateItem = {
  id: string;
  title: string;
  body: string;
  url: string;
  source: "news" | "patent";
  publishedAt: string;
  company?: string;
  ipc?: string;
};

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function matchesAny(haystack: string, needles: string[]): boolean {
  return needles
    .map((n) => n.trim())
    .filter(Boolean)
    .some((needle) => haystack.includes(normalize(needle)));
}

/**
 * Strict AND relevance:
 * (companies ∪ competitors) AND technologies
 */
export function matchesAndLogic(item: CandidateItem, criteria: BulletinSectionCriteria): boolean {
  const haystack = normalize([item.title, item.body, item.company, item.ipc].filter(Boolean).join(" "));
  const entities = [...criteria.companies, ...criteria.competitors];
  const hasEntity = matchesAny(haystack, entities);
  const hasTech = matchesAny(haystack, criteria.technologies);
  return hasEntity && hasTech;
}

export function filterByAndLogic(
  items: CandidateItem[],
  criteria: BulletinSectionCriteria,
): CandidateItem[] {
  return items.filter((item) => matchesAndLogic(item, criteria));
}

export type DedupRecord = { url: string; title: string };

function jaccard(a: string, b: string): number {
  const ta = new Set(normalize(a).split(/\s+/).filter(Boolean));
  const tb = new Set(normalize(b).split(/\s+/).filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / (ta.size + tb.size - inter);
}

export function rejectDuplicates(
  items: CandidateItem[],
  history: DedupRecord[],
  similarityThreshold = 0.85,
): CandidateItem[] {
  const urls = new Set(history.map((h) => h.url.toLowerCase()));
  return items.filter((item) => {
    if (urls.has(item.url.toLowerCase())) return false;
    return !history.some((h) => jaccard(h.title, item.title) >= similarityThreshold);
  });
}
