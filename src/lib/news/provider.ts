export type NewsSearchItem = {
  title: string;
  url: string;
  source: string;
  publishedAt?: string;
  snippet?: string;
};

export type NewsSearchInput = {
  query: string;
  limit?: number;
  language?: string;
};

export interface NewsSearchProvider {
  id: string;
  search(input: NewsSearchInput): Promise<NewsSearchItem[]>;
}

const DEMO_SEED: NewsSearchItem[] = [
  {
    title: "US8268469B2 · Tesla battery pack gas exhaust system",
    url: "https://patents.google.com/patent/US8268469B2/en",
    source: "Google Patents",
    publishedAt: "2012-09-18T00:00:00.000Z",
    snippet: "Patente concedida. El recinto de Tesla canaliza el gas de un thermal runaway en el battery pack.",
  },
  {
    title: "US9093726B2 · Active thermal runaway mitigation",
    url: "https://patents.google.com/patent/US9093726B2/en",
    source: "Google Patents",
    publishedAt: "2015-07-28T00:00:00.000Z",
    snippet: "Patente concedida de Tesla. Mitigación activa dentro del battery pack.",
  },
  {
    title: "US8082743B2 · Battery pack temperature optimization",
    url: "https://patents.google.com/patent/US8082743B2/en",
    source: "Google Patents",
    publishedAt: "2011-12-20T00:00:00.000Z",
    snippet: "Patente concedida de Tesla. Control que optimiza la temperatura del pack.",
  },
];

export const demoNewsProvider: NewsSearchProvider = {
  id: "demo",
  async search(input) {
    const q = input.query.trim().toLowerCase();
    const limit = Math.min(input.limit ?? 8, 20);
    const filtered = q
      ? DEMO_SEED.filter(
          (i) =>
            i.title.toLowerCase().includes(q) ||
            (i.snippet ?? "").toLowerCase().includes(q) ||
            i.source.toLowerCase().includes(q),
        )
      : DEMO_SEED;
    return (filtered.length ? filtered : DEMO_SEED).slice(0, limit);
  },
};

export const tavilyNewsProvider: NewsSearchProvider = {
  id: "tavily",
  async search(input) {
    const key = process.env.TAVILY_API_KEY;
    if (!key) return demoNewsProvider.search(input);
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query: input.query,
        search_depth: "basic",
        max_results: Math.min(input.limit ?? 8, 10),
        include_answer: false,
      }),
    });
    if (!res.ok) throw new Error(`tavily_${res.status}`);
    const data = (await res.json()) as {
      results?: Array<{ title?: string; url?: string; content?: string; published_date?: string }>;
    };
    return (data.results ?? []).map((r) => ({
      title: r.title ?? "Sin título",
      url: r.url ?? "",
      source: "tavily",
      publishedAt: r.published_date,
      snippet: r.content,
    }));
  },
};

export const braveNewsProvider: NewsSearchProvider = {
  id: "brave",
  async search(input) {
    const key = process.env.BRAVE_SEARCH_API_KEY;
    if (!key) return demoNewsProvider.search(input);
    const params = new URLSearchParams({
      q: input.query,
      count: String(Math.min(input.limit ?? 8, 20)),
    });
    const res = await fetch(`https://api.search.brave.com/res/v1/news/search?${params}`, {
      headers: { Accept: "application/json", "X-Subscription-Token": key },
    });
    if (!res.ok) throw new Error(`brave_${res.status}`);
    const data = (await res.json()) as {
      results?: Array<{ title?: string; url?: string; description?: string; age?: string; meta_url?: { hostname?: string } }>;
    };
    return (data.results ?? []).map((r) => ({
      title: r.title ?? "Sin título",
      url: r.url ?? "",
      source: r.meta_url?.hostname ?? "brave",
      snippet: r.description,
      publishedAt: r.age,
    }));
  },
};

/** Pick first configured external provider, else demo. */
export function resolveNewsProvider(): NewsSearchProvider {
  if (process.env.TAVILY_API_KEY) return tavilyNewsProvider;
  if (process.env.BRAVE_SEARCH_API_KEY) return braveNewsProvider;
  return demoNewsProvider;
}
