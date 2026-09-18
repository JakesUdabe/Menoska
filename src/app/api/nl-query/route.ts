import { NextResponse } from "next/server";
import { z } from "zod";
import { parseNlQueryWithLlm } from "@/lib/ai/engine";

const schema = z.object({
  query: z.string().refine((q) => q.trim().split(/\s+/).filter(Boolean).length >= 15, {
    message: "min_15_words",
  }),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "min_15_words" }, { status: 400 });
  }
  const result = await parseNlQueryWithLlm(parsed.data.query);
  return NextResponse.json(result);
}
