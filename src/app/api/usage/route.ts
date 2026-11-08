import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/guard";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createServerSupabase } from "@/lib/supabase/server";

/** Optional: recent AI usage for current org when Supabase is configured. Demo clients use localStorage. */
export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ events: [], demo: true });
  }

  const auth = await requireApiAuth(request, "usage");
  if (!auth.ok) return auth.response;

  const supabase = await createServerSupabase();
  if (!supabase) {
    return NextResponse.json({ events: [], demo: false });
  }

  const { data: profile } = await supabase.from("mc_profiles").select("organization_id").eq("id", auth.userId).maybeSingle();
  const orgId = (profile as { organization_id?: string | null } | null)?.organization_id;

  let query = supabase
    .from("mc_ai_usage_events")
    .select("id, user_id, organization_id, kind, tokens_in, tokens_out, meta, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  if (orgId) {
    query = query.eq("organization_id", orgId);
  } else {
    query = query.eq("user_id", auth.userId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message, events: [] }, { status: 500 });
  }

  const events = (data ?? []).map((row) => ({
    id: row.id as string,
    userId: row.user_id as string,
    kind: row.kind as string,
    at: (row.created_at as string) ?? new Date().toISOString(),
    tokensIn: (row.tokens_in as number) ?? 0,
    tokensOut: (row.tokens_out as number) ?? 0,
    meta: (row.meta as Record<string, unknown>) ?? {},
  }));

  return NextResponse.json({ events, demo: false });
}
