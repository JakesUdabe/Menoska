import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/guard";
import { listAuditEvents } from "@/lib/audit-store";
import { DEMO_PROFILES } from "@/lib/demo-data";
import { isOrgAdmin, isSuperAdmin } from "@/lib/rbac";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";

function toCsv(rows: Array<Record<string, string>>): string {
  if (!rows.length) return "id,created_at,organization_id,user_id,kind,title\n";
  const headers = Object.keys(rows[0]);
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h] ?? "")).join(","))].join("\n");
}

export async function GET(request: Request) {
  const auth = await requireApiAuth(request, "audit-export");
  if (!auth.ok) return auth.response;

  let role: string | null = null;
  let orgId: string | null = null;

  if (auth.demo) {
    const profile = DEMO_PROFILES.find((p) => p.id === auth.userId);
    role = profile?.role ?? request.headers.get("x-demo-role");
    orgId = profile?.organizationId ?? request.headers.get("x-demo-org-id");
  } else if (isSupabaseConfigured()) {
    const supabase = await createServerSupabase();
    if (supabase) {
      const { data } = await supabase
        .from("mc_profiles")
        .select("role, organization_id")
        .eq("id", auth.userId)
        .maybeSingle();
      role = (data as { role?: string } | null)?.role ?? null;
      orgId = (data as { organization_id?: string } | null)?.organization_id ?? null;
    }
  }

  if (!isOrgAdmin(role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let rows: Array<Record<string, string>> = [];

  if (isSupabaseConfigured() && !auth.demo) {
    const supabase = await createServerSupabase();
    if (supabase) {
      let query = supabase
        .from("mc_activity_events")
        .select("id, organization_id, user_id, kind, title, created_at")
        .like("kind", "audit.%")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (!isSuperAdmin(role) && orgId) {
        query = query.eq("organization_id", orgId);
      }
      const { data } = await query;
      if (data?.length) {
        rows = data.map((e) => ({
          id: String(e.id),
          created_at: String(e.created_at),
          organization_id: String(e.organization_id ?? ""),
          user_id: String(e.user_id ?? ""),
          kind: String(e.kind),
          title: String(e.title),
        }));
      }
    }
  }

  if (!rows.length) {
    const events = await listAuditEvents({
      organizationId: isSuperAdmin(role) ? undefined : orgId ?? undefined,
      limit: 2000,
    });
    rows = events.map((e) => ({
      id: e.id,
      created_at: e.createdAt,
      organization_id: e.organizationId ?? "",
      user_id: e.userId ?? "",
      kind: e.kind,
      title: e.title,
    }));
  }

  const csv = toCsv(rows);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="menoska-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
