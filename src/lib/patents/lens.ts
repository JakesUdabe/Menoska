export type PatentHit = {
  id: string;
  title: string;
  abstract: string;
  url: string;
  applicants: string[];
  ipc: string[];
  publishedAt: string;
};

const LENS_BASE = "https://api.lens.org/patent/search";

export async function searchPatents(query: string, size = 10): Promise<PatentHit[]> {
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
      include: ["biblio", "abstract"],
    }),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    data?: Array<{
      lens_id?: string;
      date_published?: string;
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
  }));
}

export async function searchPatentsEpoFallback(query: string): Promise<PatentHit[]> {
  const key = process.env.EPO_OPS_KEY;
  const secret = process.env.EPO_OPS_SECRET;
  if (!key || !secret) return [];
  const basic = Buffer.from(`${key}:${secret}`).toString("base64");
  const tokenRes = await fetch("https://ops.epo.org/3.2/auth/accesstoken", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!tokenRes.ok) return [];
  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  const access = tokenJson.access_token;
  if (!access) return [];
  const search = await fetch(
    `https://ops.epo.org/3.2/rest-services/published-data/search?q=${encodeURIComponent(query)}`,
    { headers: { Authorization: `Bearer ${access}`, Accept: "application/json" } },
  );
  if (!search.ok) return [];
  return [];
}
