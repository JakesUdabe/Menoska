import { NextResponse } from "next/server";
import { z } from "zod";
import { generateReportMarkdown } from "@/lib/reports/generate";
import { REPORT_KINDS, reportTemplateSchema } from "@/lib/reports/types";
import { DEFAULT_TEMPLATES } from "@/lib/reports/defaults";
import { requireApiAuthWithPlan } from "@/lib/api/plan-guard";
import { assertAiQuota, estimateTokens, extraAiFromRequest, recordAiUsage } from "@/lib/ai/usage";
import { track } from "@/lib/analytics-server";

const schema = z.object({
  kind: z.enum(REPORT_KINDS),
  answers: z.record(z.string()).default({}),
  template: reportTemplateSchema.optional(),
});

export async function POST(request: Request) {
  const auth = await requireApiAuthWithPlan(request, "reports-generate");
  if (!auth.ok) return auth.response;

  const quota = await assertAiQuota({
    userId: auth.userId,
    organizationId: auth.organizationId,
    plan: auth.plan,
    extraAi: extraAiFromRequest(request),
  });
  if (quota) return quota;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const template = parsed.data.template ?? DEFAULT_TEMPLATES[parsed.data.kind];
  if (template.kind !== parsed.data.kind) {
    return NextResponse.json({ error: "kind_mismatch" }, { status: 400 });
  }
  try {
    const result = await generateReportMarkdown({
      kind: parsed.data.kind,
      template,
      answers: parsed.data.answers,
    });
    const inText = JSON.stringify(parsed.data.answers);
    await recordAiUsage({
      userId: auth.userId,
      organizationId: auth.organizationId,
      kind: "report_generate",
      tokensIn: estimateTokens(inText),
      tokensOut: estimateTokens(result.markdown ?? ""),
      meta: { kind: parsed.data.kind, demo: auth.demo },
    });
    void track("report_generate", {
      userId: auth.userId,
      organizationId: auth.organizationId,
      kind: parsed.data.kind,
      demo: auth.demo,
    });
    return NextResponse.json({ ...result, userId: auth.userId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "generate_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
