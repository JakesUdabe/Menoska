import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/guard";
import { DEMO_PROFILES } from "@/lib/demo-data";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * GDPR data export. Auth required.
 * Demo: profile from DEMO_PROFILES (+ optional `x-demo-export` base64 JSON for localStorage dump).
 * Supabase: profile + bulletins + reports + worksheets from mc_*.
 */
export async function GET(request: Request) {
  const auth = await requireApiAuth(request, "me-export");
  if (!auth.ok) return auth.response;

  const exportedAt = new Date().toISOString();

  if (auth.demo || !isSupabaseConfigured()) {
    const profile = DEMO_PROFILES.find((p) => p.id === auth.userId) ?? {
      id: auth.userId,
      email: request.headers.get("x-demo-email") ?? "",
    };
    let bulletins: unknown[] = [];
    let reports: unknown[] = [];
    let worksheets: Record<string, unknown> = {};
    const raw = request.headers.get("x-demo-export")?.trim();
    if (raw) {
      try {
        const json = Buffer.from(raw, "base64").toString("utf8");
        const parsed = JSON.parse(json) as {
          bulletins?: unknown[];
          reports?: unknown[];
          worksheets?: Record<string, unknown>;
        };
        if (Array.isArray(parsed.bulletins)) bulletins = parsed.bulletins;
        if (Array.isArray(parsed.reports)) reports = parsed.reports;
        if (parsed.worksheets && typeof parsed.worksheets === "object") worksheets = parsed.worksheets;
      } catch {
        /* ignore malformed demo payload */
      }
    }
    return NextResponse.json({
      exportedAt,
      demo: true,
      profile,
      bulletins,
      reports,
      worksheets,
    });
  }

  const supabase = await createServerSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "auth" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("mc_profiles").select("*").eq("id", auth.userId).maybeSingle();

  const { data: bulletins } = await supabase
    .from("mc_bulletins")
    .select("*, mc_bulletin_sections(*), mc_bulletin_recipients(*)")
    .eq("created_by", auth.userId);

  const { data: reports } = await supabase
    .from("mc_intelligence_reports")
    .select("*")
    .eq("created_by", auth.userId);

  const { data: worksheets } = await supabase.from("mc_worksheets").select("*").eq("user_id", auth.userId);

  return NextResponse.json({
    exportedAt,
    demo: false,
    profile: profile ?? { id: auth.userId },
    bulletins: bulletins ?? [],
    reports: reports ?? [],
    worksheets: worksheets ?? [],
  });
}
