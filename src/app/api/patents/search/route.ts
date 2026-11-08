import { NextResponse } from "next/server";
import { z } from "zod";
import { searchPatents, searchPatentsEpoFallback, type PatentHit } from "@/lib/patents/lens";
import { DEMO_CANDIDATES } from "@/lib/demo-data";
import { requireApiAuthWithPlan, planRequiredResponse } from "@/lib/api/plan-guard";
import { canUsePatents } from "@/lib/rbac";

const schema = z.object({
  query: z.string().min(1),
  ipc: z.string().optional(),
  size: z.number().int().min(1).max(50).optional(),
});

function demoPatents(query: string, ipc?: string): PatentHit[] {
  const q = query.toLowerCase();
  const ipcLower = ipc?.toLowerCase() ?? "";
  return DEMO_CANDIDATES.filter((c) => c.source === "patent")
    .filter((c) => {
      const hay = `${c.title} ${c.body} ${c.company ?? ""} ${c.ipc ?? ""}`.toLowerCase();
      const matchQ = !q || q.length < 3 || hay.includes(q.split(/\s+/)[0] ?? "") || hay.includes(q);
      const matchIpc = !ipcLower || (c.ipc ?? "").toLowerCase().includes(ipcLower);
      return matchQ && matchIpc;
    })
    .map((c) => ({
      id: c.id,
      title: c.title,
      abstract: c.body,
      url: c.url,
      applicants: c.company ? [c.company] : [],
      ipc: c.ipc ? [c.ipc] : [],
      publishedAt: c.publishedAt,
    }));
}

export async function POST(request: Request) {
  const auth = await requireApiAuthWithPlan(request, "patents");
  if (!auth.ok) return auth.response;
  if (!canUsePatents(auth.plan)) return planRequiredResponse();

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const size = parsed.data.size ?? 10;
  let hits = await searchPatents(parsed.data.query, size);
  if (!hits.length) {
    hits = await searchPatentsEpoFallback(parsed.data.query);
  }
  if (!hits.length) {
    hits = demoPatents(parsed.data.query, parsed.data.ipc).slice(0, size);
    return NextResponse.json({ patents: hits, demo: true });
  }
  return NextResponse.json({ patents: hits.slice(0, size), demo: false });
}
