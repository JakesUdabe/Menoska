import { isSupabaseConfigured, createClient } from "@/lib/supabase/client";
import {
  listOrgs as listLocal,
  splitOrganization as splitLocal,
  upsertOrg as upsertLocal,
  type DemoOrg,
} from "@/lib/orgs-store";
import type { PlanType } from "@/lib/rbac";

export type OrgRecord = DemoOrg & { memberCount?: number };

type OrgRow = {
  id: string;
  name: string;
  domain: string | null;
  plan: PlanType;
  stripe_subscription_id: string | null;
  created_at: string;
};

function mapRow(row: OrgRow, memberCount = 0): OrgRecord {
  return {
    id: row.id,
    name: row.name,
    domain: row.domain ?? "",
    plan: row.plan,
    mrr: 0,
    status: row.stripe_subscription_id ? "active" : "trialing",
    memberCount,
  };
}

function slugFrom(name: string, domain: string): string {
  const base = (domain || name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return base || `org-${Date.now()}`;
}

async function memberCounts(orgIds: string[]): Promise<Record<string, number>> {
  if (!orgIds.length) return {};
  const supabase = createClient();
  const { data, error } = await supabase.from("mc_profiles").select("organization_id").in("organization_id", orgIds);
  if (error) {
    console.warn("mc_profiles member count failed", error.message);
    return {};
  }
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const id = row.organization_id as string | null;
    if (!id) continue;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

export async function listOrgs(): Promise<OrgRecord[]> {
  if (!isSupabaseConfigured()) {
    return listLocal().map((o) => ({ ...o, memberCount: undefined }));
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("mc_organizations")
    .select("id, name, domain, plan, stripe_subscription_id, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("mc_organizations list failed", error.message);
    return listLocal().map((o) => ({ ...o, memberCount: undefined }));
  }
  const rows = (data as OrgRow[] | null) ?? [];
  const counts = await memberCounts(rows.map((r) => r.id));
  return rows.map((r) => mapRow(r, counts[r.id] ?? 0));
}

export async function upsertOrg(org: DemoOrg): Promise<OrgRecord> {
  if (!isSupabaseConfigured()) {
    return { ...upsertLocal(org), memberCount: undefined };
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("mc_organizations")
    .upsert(
      {
        id: org.id,
        name: org.name,
        domain: org.domain || null,
        slug: slugFrom(org.name, org.domain),
        plan: org.plan,
      },
      { onConflict: "id" },
    )
    .select("id, name, domain, plan, stripe_subscription_id, created_at")
    .maybeSingle();
  if (error || !data) {
    console.warn("mc_organizations upsert failed", error?.message);
    return { ...upsertLocal(org), memberCount: undefined };
  }
  try {
    upsertLocal(org);
  } catch {
    /* ignore */
  }
  return mapRow(data as OrgRow);
}

export async function splitOrganization(
  sourceId: string,
  newName: string,
  newDomain: string,
): Promise<OrgRecord> {
  if (!isSupabaseConfigured()) {
    return { ...splitLocal(sourceId, newName, newDomain), memberCount: 0 };
  }
  const orgs = await listOrgs();
  const source = orgs.find((o) => o.id === sourceId);
  const created: DemoOrg = {
    id: crypto.randomUUID(),
    name: newName,
    domain: newDomain.replace(/^@/, "").toLowerCase(),
    plan: source?.plan ?? "starter",
    mrr: 0,
    status: "trialing",
  };
  return upsertOrg(created);
}
