import { isSupabaseConfigured, createClient } from "@/lib/supabase/client";
import {
  deleteReport as deleteLocal,
  getReport as getLocal,
  listReportsForUser as listLocal,
  upsertReport as upsertLocal,
} from "@/lib/reports/reports-store";
import type { ReportKind, ReportStatus, StoredReport } from "@/lib/reports/types";

type ReportRow = {
  id: string;
  organization_id: string;
  created_by: string;
  kind: ReportKind;
  title: string;
  answers: Record<string, string> | null;
  markdown: string;
  sources: StoredReport["sources"] | null;
  status: ReportStatus;
  created_at: string;
  updated_at: string;
};

function mapRow(row: ReportRow): StoredReport {
  return {
    id: row.id,
    kind: row.kind,
    templateId: row.kind,
    createdBy: row.created_by,
    organizationId: row.organization_id,
    title: row.title,
    answers: row.answers && typeof row.answers === "object" ? row.answers : {},
    markdown: row.markdown ?? "",
    sources: Array.isArray(row.sources) ? row.sources : [],
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listReportsForUser(
  userId: string,
  organizationId: string | null,
  seeOrg: boolean,
  kind?: ReportKind,
): Promise<StoredReport[]> {
  if (!isSupabaseConfigured()) {
    return listLocal(userId, organizationId, seeOrg, kind);
  }
  const supabase = createClient();
  let query = supabase.from("mc_intelligence_reports").select("*").order("updated_at", { ascending: false });
  if (kind) query = query.eq("kind", kind);
  if (seeOrg && organizationId) query = query.eq("organization_id", organizationId);
  else query = query.eq("created_by", userId);

  const { data, error } = await query;
  if (error) {
    console.warn("mc_intelligence_reports list failed", error.message);
    return listLocal(userId, organizationId, seeOrg, kind);
  }
  return (data as ReportRow[] | null)?.map(mapRow) ?? [];
}

export async function getReport(id: string): Promise<StoredReport | undefined> {
  if (!isSupabaseConfigured()) {
    return getLocal(id);
  }
  const supabase = createClient();
  const { data, error } = await supabase.from("mc_intelligence_reports").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.warn("mc_intelligence_reports get failed", error.message);
    return getLocal(id);
  }
  return data ? mapRow(data as ReportRow) : undefined;
}

export async function upsertReport(report: StoredReport): Promise<StoredReport> {
  const next = { ...report, updatedAt: new Date().toISOString() };
  if (!isSupabaseConfigured()) {
    return upsertLocal(next);
  }

  const supabase = createClient();
  const { error } = await supabase.from("mc_intelligence_reports").upsert(
    {
      id: next.id,
      organization_id: next.organizationId,
      created_by: next.createdBy,
      kind: next.kind,
      title: next.title,
      answers: next.answers,
      markdown: next.markdown,
      sources: next.sources,
      status: next.status,
      created_at: next.createdAt,
      updated_at: next.updatedAt,
    },
    { onConflict: "id" },
  );
  if (error) {
    console.warn("mc_intelligence_reports upsert failed", error.message);
    return upsertLocal(next);
  }
  try {
    upsertLocal(next);
  } catch {
    /* ignore */
  }
  return next;
}

export async function deleteReport(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    deleteLocal(id);
    return;
  }
  const supabase = createClient();
  const { error } = await supabase.from("mc_intelligence_reports").delete().eq("id", id);
  if (error) console.warn("mc_intelligence_reports delete failed", error.message);
  try {
    deleteLocal(id);
  } catch {
    /* ignore */
  }
}
