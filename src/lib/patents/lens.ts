import { epoConfigured, parseEpoOpsHits, searchPatentsEpo } from "./epo";

export type PatentHit = {
  id: string;
  title: string;
  abstract: string;
  url: string;
  applicants: string[];
  ipc: string[];
  publishedAt: string;
  /** Official claim text when the register returns it. */
  claims?: string[];
  /** EPO legal status. Absent when the source did not return it. */
  legalStatus?: "alive" | "dead" | "pending" | "unknown";
};

/** Pull claim strings out of a Lens (or similar) claims payload. */
export function extractClaimTexts(claims: unknown): string[] {
  const out: string[] = [];
  const visit = (node: unknown) => {
    if (!node) return;
    if (typeof node === "string") {
      const text = node.trim();
      if (text.length > 20) out.push(text);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node === "object") {
      const record = node as Record<string, unknown>;
      for (const key of ["claim_text", "claim-text", "text", "claim", "claims", "p", "$"]) {
        if (key in record) visit(record[key]);
      }
    }
  };
  visit(claims);
  return [...new Set(out)].slice(0, 12);
}

const LENS_BASE = "https://api.lens.org/patent/search";

export async function searchPatents(query: string, size = 10): Promise<PatentHit[]> {
  if (epoConfigured()) {
    const epoHits = await searchPatentsEpo(query, size);
    if (epoHits.length) return epoHits;
  }
  return searchLens(query, size);
}

async function searchLens(query: string, size = 10): Promise<PatentHit[]> {
  const token = process.env.LENS_API_TOKEN;
  if (!token) return [];

  const res = await fetch(LENS_BASE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: { match: { title: query } },
      size,
      include: ["biblio", "abstract", "claims"],
    }),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    data?: Array<{
      lens_id?: string;
      date_published?: string;
      claims?: unknown;
      biblio?: {
        invention_title?: Array<{ text?: string }>;
        parties?: { applicants?: Array<{ extracted_name?: { value?: string } }> };
        class_cpc?: { classifications?: Array<{ symbol?: string }> };
      };
      abstract?: Array<{ text?: string }>;
    }>;
  };

  return (data.data ?? []).map((row) => ({
    id: row.lens_id ?? crypto.randomUUID(),
    title: row.biblio?.invention_title?.[0]?.text ?? "Untitled patent",
    abstract: row.abstract?.[0]?.text ?? "",
    url: row.lens_id ? `https://www.lens.org/lens/patent/${row.lens_id}` : "",
    applicants: (row.biblio?.parties?.applicants ?? [])
      .map((a) => a.extracted_name?.value)
      .filter((v): v is string => Boolean(v)),
    ipc: (row.biblio?.class_cpc?.classifications ?? [])
      .map((c) => c.symbol)
      .filter((v): v is string => Boolean(v)),
    publishedAt: row.date_published ?? new Date().toISOString().slice(0, 10),
    claims: extractClaimTexts(row.claims),
  }));
}

export async function searchPatentsEpoFallback(query: string, size = 10): Promise<PatentHit[]> {
  return searchPatentsEpo(query, size);
}

export { parseEpoOpsHits };
