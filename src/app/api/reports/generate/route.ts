import { NextResponse } from "next/server";
import { z } from "zod";
import { generateReportMarkdown } from "@/lib/reports/generate";
import { REPORT_KINDS, reportTemplateSchema } from "@/lib/reports/types";
import { DEFAULT_TEMPLATES } from "@/lib/reports/defaults";

const schema = z.object({
  kind: z.enum(REPORT_KINDS),
  answers: z.record(z.string()).default({}),
  template: reportTemplateSchema.optional(),
});

export async function POST(request: Request) {
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
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "generate_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
