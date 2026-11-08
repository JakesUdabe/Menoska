import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAuth } from "@/lib/api/guard";
import { resolveNewsProvider } from "@/lib/news/provider";

const schema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(20).optional(),
  language: z.string().max(8).optional(),
});

export async function POST(request: Request) {
  const auth = await requireApiAuth(request, "news-search");
  if (!auth.ok) return auth.response;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  try {
    const provider = resolveNewsProvider();
    const items = await provider.search({
      query: parsed.data.query,
      limit: parsed.data.limit,
      language: parsed.data.language,
    });
    return NextResponse.json({
      ok: true,
      provider: provider.id,
      items,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "search_failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
