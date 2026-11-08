import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";

/** Env presence only — never return secret values. */
export async function GET() {
  const stripe = Boolean(process.env.STRIPE_SECRET_KEY);
  const resend = Boolean(process.env.RESEND_API_KEY);
  const supabase = isSupabaseConfigured();
  const ai = Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
  const patents = Boolean(
    process.env.LENS_API_TOKEN || (process.env.EPO_OPS_KEY && process.env.EPO_OPS_SECRET),
  );

  return NextResponse.json({
    ok: true,
    demo: !supabase,
    stripe,
    resend,
    supabase,
    ai,
    patents,
    ts: new Date().toISOString(),
  });
}
