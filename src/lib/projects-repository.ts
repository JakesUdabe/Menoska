import { isSupabaseConfigured, createClient } from "@/lib/supabase/client";
import { recordActivity } from "@/lib/activity";
import {
  deleteProjectLocal,
  getProjectLocal,
  listProjectsLocal,
  saveProjectLocal,
  type ProjectLink,
  type StoredProject,
} from "@/lib/projects-store";

export type { ProjectLink, StoredProject };

type ProjectRow = {
  id: string;
  organization_id: string;
  created_by: string;
  name: string;
  description: string;
  status: string;
  meta: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  mc_project_links?: Array<{
    id: string;
    kind: string;
    ref_id: string;
    label: string;
    created_at: string;
  }>;
};

function mapLink(row: {
  id: string;
  kind: string;
  ref_id: string;
  label: string;
  created_at: string;
}): ProjectLink {
  const kind = row.kind as ProjectLink["kind"];
  return {
    id: row.id,
    kind: ["worksheet", "report", "bulletin", "other"].includes(kind) ? kind : "other",
    refId: row.ref_id,
    label: row.label ?? "",
    createdAt: row.created_at,
  };
}

function mapRow(row: ProjectRow): StoredProject {
  return {
    id: row.id,
    organizationId: row.organization_id,
    createdBy: row.created_by,
    name: row.name,
    description: row.description ?? "",
    status: (row.status as StoredProject["status"]) || "active",
    links: (row.mc_project_links ?? []).map(mapLink),
    meta: row.meta && typeof row.meta === "object" ? row.meta : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT = "*, mc_project_links(id, kind, ref_id, label, created_at)";

export async function listProjectsForUser(
  userId: string,
  organizationId: string | null,
  seeOrg: boolean,
): Promise<StoredProject[]> {
  if (!isSupabaseConfigured()) {
    return listProjectsLocal(userId, organizationId, seeOrg);
  }
  const supabase = createClient();
  let query = supabase.from("mc_projects").select(SELECT).order("updated_at", { ascending: false });
  if (seeOrg && organizationId) {
    query = query.eq("organization_id", organizationId);
  } else {
    query = query.eq("created_by", userId);
  }
  const { data, error } = await query;
  if (error) {
    console.warn("mc_projects list failed", error.message);
    return listProjectsLocal(userId, organizationId, seeOrg);
  }
  return (data as ProjectRow[] | null)?.map(mapRow) ?? [];
}

export async function getProject(id: string): Promise<StoredProject | undefined> {
  if (!isSupabaseConfigured()) {
    return getProjectLocal(id);
  }
  const supabase = createClient();
  const { data, error } = await supabase.from("mc_projects").select(SELECT).eq("id", id).maybeSingle();
  if (error) {
    console.warn("mc_projects get failed", error.message);
    return getProjectLocal(id);
  }
  return data ? mapRow(data as ProjectRow) : undefined;
}

export async function saveProject(
  input: StoredProject,
  opts?: { recordCreate?: boolean },
): Promise<StoredProject> {
  const next: StoredProject = {
    ...input,
    updatedAt: new Date().toISOString(),
    links: input.links ?? [],
  };

  if (!isSupabaseConfigured()) {
    const saved = saveProjectLocal(next);
    if (opts?.recordCreate) {
      void recordActivity({
        organizationId: saved.organizationId,
        userId: saved.createdBy,
        kind: "project_created",
        title: `Proyecto: ${saved.name}`,
        meta: { projectId: saved.id },
      });
    }
    return saved;
  }

  const supabase = createClient();
  const { error } = await supabase.from("mc_projects").upsert(
    {
      id: next.id,
      organization_id: next.organizationId,
      created_by: next.createdBy,
      name: next.name,
      description: next.description,
      status: next.status,
      meta: next.meta,
      created_at: next.createdAt,
      updated_at: next.updatedAt,
    },
    { onConflict: "id" },
  );
  if (error) {
    console.warn("mc_projects upsert failed", error.message);
    return saveProjectLocal(next);
  }

  await supabase.from("mc_project_links").delete().eq("project_id", next.id);
  if (next.links.length) {
    const { error: linkErr } = await supabase.from("mc_project_links").insert(
      next.links.map((l) => ({
        id: l.id,
        project_id: next.id,
        kind: l.kind,
        ref_id: l.refId,
        label: l.label,
        created_at: l.createdAt,
      })),
    );
    if (linkErr) console.warn("mc_project_links insert failed", linkErr.message);
  }

  try {
    saveProjectLocal(next);
  } catch {
    /* ignore */
  }

  if (opts?.recordCreate) {
    void recordActivity({
      organizationId: next.organizationId,
      userId: next.createdBy,
      kind: "project_created",
      title: `Proyecto: ${next.name}`,
      meta: { projectId: next.id },
    });
  }

  return next;
}

export async function deleteProject(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    deleteProjectLocal(id);
    return;
  }
  const supabase = createClient();
  const { error } = await supabase.from("mc_projects").delete().eq("id", id);
  if (error) console.warn("mc_projects delete failed", error.message);
  try {
    deleteProjectLocal(id);
  } catch {
    /* ignore */
  }
}

export function newProjectId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `proj-${Date.now()}`;
}
