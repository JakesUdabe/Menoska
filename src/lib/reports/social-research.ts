export type SocialEvidence = {
  source: string;
  title: string;
  snippet: string;
  url?: string;
};

export type SocialQuery = {
  brands: string[];
  keywords: string[];
  platforms: string[];
  period: string;
  language?: string;
};

function demoEvidence(query: SocialQuery): SocialEvidence[] {
  const focus = [...query.brands, ...query.keywords].filter(Boolean).slice(0, 4);
  const subject = focus.join(", ") || "el tema indicado";
  return [
    {
      source: "noticias",
      title: `Cobertura reciente sobre ${subject}`,
      snippet: `En ${query.period || "el periodo indicado"} aparecen menciones a ${subject} ligadas a producto, precio y comparativas de proveedores. Sin APIs configuradas se usa un recorte ilustrativo.`,
    },
    {
      source: "voc",
      title: "Comentarios de cliente (síntesis)",
      snippet: `Los compradores destacan facilidad de uso y soporte, y critican plazos y falta de comparables. Plataformas pedidas: ${query.platforms.join(", ") || "web y reseñas"}.`,
    },
    {
      source: "redes_sociales",
      title: "Conversación profesional",
      snippet: `En foros y LinkedIn el debate gira en torno a adopción, riesgo de proveedor y casos de uso. Idiomas: ${query.language || "los del cuestionario"}.`,
    },
  ];
}

async function searchTavily(q: string): Promise<SocialEvidence[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return [];
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      query: q,
      search_depth: "basic",
      max_results: 6,
    }),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    results?: Array<{ title?: string; content?: string; url?: string }>;
  };
  return (data.results ?? []).map((r) => ({
    source: "noticias",
    title: r.title ?? "Resultado",
    snippet: r.content ?? "",
    url: r.url,
  }));
}

async function searchBrave(q: string): Promise<SocialEvidence[]> {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) return [];
  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=6`, {
    headers: { Accept: "application/json", "X-Subscription-Token": key },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    web?: { results?: Array<{ title?: string; description?: string; url?: string }> };
  };
  return (data.web?.results ?? []).map((r) => ({
    source: "web",
    title: r.title ?? "Resultado",
    snippet: r.description ?? "",
    url: r.url,
  }));
}

export async function gatherSocialEvidence(query: SocialQuery): Promise<SocialEvidence[]> {
  const q = [...query.brands, ...query.keywords].filter(Boolean).join(" ");
  if (!q.trim()) return demoEvidence(query);
  const [tavily, brave] = await Promise.all([searchTavily(q), searchBrave(q)]);
  const merged = [...tavily, ...brave];
  if (merged.length === 0) return demoEvidence(query);
  return merged.slice(0, 10);
}

export function splitLines(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
