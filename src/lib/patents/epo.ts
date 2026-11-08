import type { PatentHit } from "./lens";

export type LegalStatus = "alive" | "dead" | "pending" | "unknown";

function claimTexts(claims: unknown): string[] {
  const out: string[] = [];
  const visit = (node: unknown) => {
    if (!node) return;
    if (typeof node === "string") {
      const text = node.replace(/\s+/g, " ").trim();
      if (text.length > 40) out.push(text);
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
  return [...new Set(out)].slice(0, 8);
}

const OPS = "https://ops.epo.org/3.2/rest-services";

let tokenCache: { value: string; expiresAt: number } | null = null;

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function pickText(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (typeof node === "object" && node !== null && "$" in node) {
    const dollar = (node as { $?: unknown }).$;
    if (typeof dollar === "string" || typeof dollar === "number") return String(dollar);
  }
  return "";
}

function langOf(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const raw = (node as { "@lang"?: unknown })["@lang"];
  return typeof raw === "string" ? raw.toLowerCase() : "";
}

function preferredText(node: unknown): string {
  const items = asArray(node);
  const ranked = items
    .map((item) => ({ lang: langOf(item), text: pickText(item) || collectPlain(item) }))
    .filter((item) => item.text.length > 1);
  return (ranked.find((item) => item.lang === "en") ?? ranked[0])?.text ?? "";
}

function collectPlain(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(collectPlain).filter(Boolean).join(" ");
  if (typeof node === "object") {
    const direct = pickText(node);
    if (direct) return direct;
    return Object.values(node as Record<string, unknown>)
      .map(collectPlain)
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

/** CQL for OPS. IPC symbols become class filters; the rest searches title and abstract. */
export function cqlFromFreeText(query: string): string {
  const raw = query.replace(/["']/g, " ").replace(/\s+/g, " ").trim();
  if (/^[A-Z]{2}\d{5,}[A-Z]\d?$/i.test(raw.replace(/\s/g, ""))) {
    return `pn=${raw.replace(/\s/g, "")}`;
  }
  const ipc = raw.match(/\b[A-HY]\d{2}[A-Z](?:\d{1,4})?(?:\/\d+)?\b/gi) ?? [];
  const skip = new Set(ipc.flatMap((item) => [item.toLowerCase(), item.split("/")[0].toLowerCase()]));
  const words = raw
    .split(/[^\p{L}\p{N}-]+/u)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !/^\d+$/.test(word) && !skip.has(word.toLowerCase()))
    .slice(0, 6);
  const text = words.map((word) => `ta all "${word}"`).join(" and ");
  const classes = ipc
    .slice(0, 2)
    .map((symbol) => `ic=${symbol.split("/")[0]}`)
    .join(" and ");
  return [text, classes].filter(Boolean).join(" and ") || `ta all "${raw.slice(0, 80)}"`;
}

function findDocs(node: unknown, acc: Record<string, unknown>[]): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach((item) => findDocs(item, acc));
    return;
  }
  const record = node as Record<string, unknown>;
  if ("bibliographic-data" in record) acc.push(record);
  for (const value of Object.values(record)) findDocs(value, acc);
}

function publicationId(doc: Record<string, unknown>): { id: string; country: string; number: string; kind: string; date: string } {
  const biblio = (doc["bibliographic-data"] ?? {}) as Record<string, unknown>;
  const ref = (biblio["publication-reference"] ?? doc["publication-reference"] ?? {}) as Record<string, unknown>;
  const ids = asArray((ref["document-id"] as unknown) ?? (ref["ops:document-id"] as unknown));
  const chosen =
    ids.find((item) => pickText((item as Record<string, unknown>)["country"])) ??
    ids[0];
  const docObj = (chosen ?? {}) as Record<string, unknown>;
  const country = pickText(docObj.country ?? docObj["ops:country"]) || String(doc["@country"] ?? "");
  const number = pickText(docObj["doc-number"] ?? docObj["ops:doc-number"]) || String(doc["@doc-number"] ?? "");
  const kind = pickText(docObj.kind ?? docObj["ops:kind"]) || String(doc["@kind"] ?? "");
  const date = pickText(docObj.date ?? docObj["ops:date"]).replace(/\D/g, "");
  const id = `${country}${number}${kind}`.replace(/\s+/g, "");
  return { id, country, number, kind, date };
}

function applicantsOf(biblio: Record<string, unknown>): string[] {
  const names: string[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const record = node as Record<string, unknown>;
    if ("applicant-name" in record) {
      const text = preferredText(record["applicant-name"]);
      if (text && !names.includes(text)) names.push(text);
    }
    Object.values(record).forEach(visit);
  };
  visit(biblio.parties);
  return names.filter((name) => name.length > 1 && name.length < 120).slice(0, 6);
}

function ipcOf(biblio: Record<string, unknown>): string[] {
  const found = new Set<string>();
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const text = pickText(node);
    const match = text.match(/[A-HY]\d{2}[A-Z]\d*(?:\/\d+)?/);
    if (match) found.add(match[0]);
    Object.values(node as Record<string, unknown>).forEach(visit);
  };
  visit(biblio["classifications-ipcr"] ?? biblio["patent-classifications"]);
  return [...found].slice(0, 6);
}

export function parseEpoBiblioDocs(data: unknown): PatentHit[] {
  const docs: Record<string, unknown>[] = [];
  findDocs(data, docs);
  const hits: PatentHit[] = [];
  const seen = new Set<string>();
  for (const doc of docs) {
    const pub = publicationId(doc);
    if (!pub.number || seen.has(pub.id)) continue;
    seen.add(pub.id);
    const biblio = (doc["bibliographic-data"] ?? {}) as Record<string, unknown>;
    const title = preferredText(biblio["invention-title"]) || [pub.country, pub.number, pub.kind].filter(Boolean).join(" ");
    const abstract = preferredText(doc.abstract ?? biblio.abstract);
    const publishedAt = pub.date.length === 8 ? `${pub.date.slice(0, 4)}-${pub.date.slice(4, 6)}-${pub.date.slice(6, 8)}` : "";
    hits.push({
      id: pub.id,
      title,
      abstract,
      url: `https://worldwide.espacenet.com/patent/search?q=${encodeURIComponent(`${pub.country}${pub.number}`)}`,
      applicants: applicantsOf(biblio),
      ipc: ipcOf(biblio),
      publishedAt,
    });
  }
  return hits;
}

/** Parse OPS published-data search JSON into PatentHit[]. Never throws. */
export function parseEpoOpsHits(data: unknown): PatentHit[] {
  try {
    if (!data || typeof data !== "object") return [];
    const root = data as Record<string, unknown>;
    const world =
      (root["ops:world-patent-data"] as Record<string, unknown> | undefined) ??
      (root["world-patent-data"] as Record<string, unknown> | undefined) ??
      root;
    const biblio =
      (world["ops:biblio-search"] as Record<string, unknown> | undefined) ??
      (world["biblio-search"] as Record<string, unknown> | undefined) ??
      world;
    const searchResult =
      (biblio["ops:search-result"] as Record<string, unknown> | undefined) ??
      (biblio["search-result"] as Record<string, unknown> | undefined) ??
      biblio;
    const refs = asArray(
      (searchResult["ops:publication-reference"] as unknown) ??
        (searchResult["publication-reference"] as unknown),
    );
    const hits: PatentHit[] = [];
    for (const ref of refs) {
      if (!ref || typeof ref !== "object") continue;
      const refObj = ref as Record<string, unknown>;
      const docIds = asArray((refObj["document-id"] as unknown) ?? (refObj["ops:document-id"] as unknown));
      const doc = docIds[0];
      if (!doc || typeof doc !== "object") continue;
      const docObj = doc as Record<string, unknown>;
      const country = pickText(docObj.country ?? docObj["ops:country"]);
      const docNumber = pickText(docObj["doc-number"] ?? docObj["ops:doc-number"]);
      const kind = pickText(docObj.kind ?? docObj["ops:kind"]);
      if (!docNumber) continue;
      const id = `${country}${docNumber}${kind}`.replace(/\s+/g, "");
      hits.push({
        id: id || crypto.randomUUID(),
        title: [country, docNumber, kind].filter(Boolean).join(" ") || docNumber,
        abstract: "",
        url: `https://worldwide.espacenet.com/patent/search?q=${encodeURIComponent(country && docNumber ? `${country}${docNumber}` : docNumber)}`,
        applicants: [],
        ipc: [],
        publishedAt: new Date().toISOString().slice(0, 10),
      });
    }
    return hits;
  } catch {
    return [];
  }
}

const DEAD = /lapse|expir|ceas|revok|withdraw|abandon|surrender|nullif|dead|not in force|caduc|retirad/i;
const ALIVE = /grant|in force|annual fee|maintained|patent specification|concedid|en vigor/i;
const PENDING = /application|search report|examination|request for examination|published/i;

export function classifyLegalEvents(events: Array<{ date: string; title: string }>): LegalStatus {
  const ordered = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const latest = ordered.at(-1)?.title ?? "";
  if (DEAD.test(latest)) return "dead";
  if (ALIVE.test(latest)) return "alive";
  if (ordered.some((event) => DEAD.test(event.title)) && !ALIVE.test(latest)) return "dead";
  if (ordered.some((event) => ALIVE.test(event.title))) return "alive";
  if (PENDING.test(latest) || ordered.some((event) => PENDING.test(event.title))) return "pending";
  return "unknown";
}

export function parseLegalStatus(data: unknown): LegalStatus {
  const events: Array<{ date: string; title: string }> = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const record = node as Record<string, unknown>;
    const title = pickText(record["ops:event-title"] ?? record["event-title"] ?? record["legal-event-title"]);
    const date = pickText(record["ops:event-date"] ?? record["event-date"]).replace(/\D/g, "");
    if (title) events.push({ date, title });
    Object.values(record).forEach(visit);
  };
  visit(data);
  if (!events.length) return "unknown";
  return classifyLegalEvents(events);
}

async function accessToken(): Promise<string | null> {
  const key = process.env.EPO_OPS_KEY;
  const secret = process.env.EPO_OPS_SECRET;
  if (!key || !secret) return null;
  if (tokenCache && tokenCache.expiresAt > Date.now() + 15_000) return tokenCache.value;
  const basic = Buffer.from(`${key}:${secret}`).toString("base64");
  const res = await fetch("https://ops.epo.org/3.2/auth/accesstoken", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) return null;
  tokenCache = {
    value: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 1000) * 1000,
  };
  return json.access_token;
}

async function opsGet(path: string, token: string): Promise<unknown | null> {
  const res = await fetch(`${OPS}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function enrich(hit: PatentHit, token: string): Promise<PatentHit> {
  const id = encodeURIComponent(hit.id);
  const [claimsDoc, legalDoc, abstractDoc] = await Promise.all([
    opsGet(`/published-data/publication/epodoc/${id}/claims`, token),
    opsGet(`/legal/publication/epodoc/${id}`, token),
    hit.abstract ? Promise.resolve(null) : opsGet(`/published-data/publication/epodoc/${id}/abstract`, token),
  ]);
  const claims = claimsDoc ? claimTexts(claimsDoc) : [];
  const abstract = hit.abstract || (abstractDoc ? preferredText(abstractDoc).slice(0, 1200) : "");
  return {
    ...hit,
    abstract,
    claims: claims.length ? claims : hit.claims,
    legalStatus: legalDoc ? parseLegalStatus(legalDoc) : "unknown",
  };
}

export function epoConfigured(): boolean {
  return Boolean(process.env.EPO_OPS_KEY && process.env.EPO_OPS_SECRET);
}

/** Published patents from EPO OPS: biblio, claims when the office has them, and legal status. */
export async function searchPatentsEpo(query: string, size = 8): Promise<PatentHit[]> {
  const token = await accessToken();
  if (!token) return [];
  const cql = cqlFromFreeText(query);
  const range = Math.min(Math.max(size, 1), 25);
  const data = await opsGet(`/published-data/search/biblio?Range=1-${range}&q=${encodeURIComponent(cql)}`, token);
  if (!data) return [];
  const parsed = parseEpoBiblioDocs(data);
  const hits = (parsed.length ? parsed : parseEpoOpsHits(data)).slice(0, range);
  const enriched: PatentHit[] = [];
  for (const hit of hits.slice(0, Math.min(hits.length, 8))) {
    enriched.push(await enrich(hit, token));
  }
  return enriched.length ? enriched : hits;
}
