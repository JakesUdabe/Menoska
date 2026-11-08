import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAuthWithPlan, planRequiredResponse } from "@/lib/api/plan-guard";
import { canUsePatents } from "@/lib/rbac";
import { searchPatents, searchPatentsEpoFallback, type PatentHit } from "@/lib/patents/lens";
import { screenFto } from "@/lib/fto/compare";
import { demoPatentHits } from "@/lib/fto/corpus";
import { patentInputFromHit } from "@/lib/fto/prepare";
import { buildSearchContexts, COMMERCIAL_ACTS, validateRdf, type TechnicalRdf } from "@/lib/fto/rdf";

const schema = z.object({
  productName: z.string(),
  commercialActs: z.array(z.enum(COMMERCIAL_ACTS)).min(1),
  commercialDetail: z.string(),
  jurisdictions: z.string(),
  cutoff: z.string(),
  technicalProblem: z.string(),
  technicalEffect: z.string(),
  embodiment: z.string(),
  essentialFeatures: z.string(),
  materialsParameters: z.string(),
  exclusions: z.string(),
  variants: z.string(),
  vocabulary: z.string(),
  ipc: z.string(),
  knownPatents: z.string(),
});

function mergeHit(map: Map<string, PatentHit>, hit: PatentHit) {
  const prev = map.get(hit.id);
  if (!prev || (hit.claims?.length ?? 0) > (prev.claims?.length ?? 0)) map.set(hit.id, hit);
}

export async function POST(request: Request) {
  const auth = await requireApiAuthWithPlan(request, "fto");
  if (!auth.ok) return auth.response;
  if (!canUsePatents(auth.plan)) return planRequiredResponse();

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const rdf = parsed.data as TechnicalRdf;
  const check = validateRdf(rdf);
  if (!check.ok) return NextResponse.json({ error: "rdf_incomplete", gaps: check.gaps }, { status: 400 });

  const contexts = buildSearchContexts(rdf);
  const found = new Map<string, PatentHit>();
  for (const context of contexts) {
    const batch = await searchPatents(context.query, 6);
    batch.forEach((hit) => mergeHit(found, hit));
  }
  if (!found.size && contexts[0]) {
    const epo = await searchPatentsEpoFallback(contexts[0].query);
    epo.forEach((hit) => mergeHit(found, hit));
  }

  const demo = found.size === 0;
  const hits = demo ? demoPatentHits() : [...found.values()];
  const report = screenFto(
    rdf,
    hits.map((hit) => patentInputFromHit(hit, demo ? { forceSource: "demo" } : undefined)),
  );

  return NextResponse.json({ ...report, demo });
}
