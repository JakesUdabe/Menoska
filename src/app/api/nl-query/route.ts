import { NextResponse } from "next/server";
import { z } from "zod";
import { parseNlQueryWithLlm } from "@/lib/ai/engine";
import { assertAiQuota, estimateTokens, extraAiFromRequest, recordAiUsage } from "@/lib/ai/usage";
import { requireApiAuthWithPlan, planRequiredResponse } from "@/lib/api/plan-guard";
import { canUseNaturalLanguage } from "@/lib/rbac";

const schema = z.object({
  query: z.string().refine((q) => q.trim().split(/\s+/).filter(Boolean).length >= 15, {
    message: "min_15_words",
  }),
});

export async function POST(request: Request) {
  const auth = await requireApiAuthWithPlan(request, "nl-query");
  if (!auth.ok) return auth.response;
  if (!canUseNaturalLanguage(auth.plan)) return planRequiredResponse();

  const quota = await assertAiQuota({
    userId: auth.userId,
    organizationId: auth.organizationId,
    plan: auth.plan,
    extraAi: extraAiFromRequest(request),
  });
  if (quota) return quota;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "min_15_words" }, { status: 400 });
  }
  const result = await parseNlQueryWithLlm(parsed.data.query);
  const outText = JSON.stringify(result);
  await recordAiUsage({
    userId: auth.userId,
    organizationId: auth.organizationId,
    kind: "nl_query",
    tokensIn: estimateTokens(parsed.data.query),
    tokensOut: estimateTokens(outText),
    meta: { demo: auth.demo },
  });
  return NextResponse.json({ ...result, userId: auth.userId });
}
