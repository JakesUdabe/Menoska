import { isSupabaseConfigured, createClient } from "@/lib/supabase/client";
import { maxActiveBulletins, type PlanType } from "@/lib/rbac";
import {
  deleteBulletin as deleteLocal,
  getBulletin as getLocal,
  listBulletinsForUser as listLocal,
  normalizeBulletin,
  saveBulletin as saveLocal,
  type StoredBulletin,
} from "@/lib/bulletins-store";

export class BulletinCapError extends Error {
  constructor() {
    super("bulletin_active_cap");
    this.name = "BulletinCapError";
  }
}

export type { StoredBulletin };

type BulletinRow = {
  id: string;
  created_by: string;
  organization_id: string;
  name: string;
  subject: string | null;
  language: string;
  frequency: StoredBulletin["frequency"];
  send_day: number | null;
  send_hour: number;
  timezone: string;
  nl_query: string | null;
  mode: string;
  status: StoredBulletin["status"];
  max_items: number;
  created_at: string;
  updated_at: string;
  mc_bulletin_sections?: Array<{
    title: string;
    companies: string[] | null;
    technologies: string[] | null;
    sort_order: number;
  }>;
  mc_bulletin_recipients?: Array<{
    email: string;
    companies: string[] | null;
    technologies: string[] | null;
  }>;
};

function mapRow(row: BulletinRow): StoredBulletin {
  const sections =
    Array.isArray(row.mc_bulletin_sections) && row.mc_bulletin_sections.length > 0
      ? [...row.mc_bulletin_sections]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((s) => ({
            title: s.title,
            companies: s.companies ?? [],
            technologies: s.technologies ?? [],
          }))
      : undefined;
  const recipients =
    Array.isArray(row.mc_bulletin_recipients) && row.mc_bulletin_recipients.length > 0
      ? row.mc_bulletin_recipients.map((r) => ({
          email: r.email,
          companies: r.companies ?? [],
          technologies: r.technologies ?? [],
        }))
      : [];

  return normalizeBulletin({
    id: row.id,
    createdBy: row.created_by,
    organizationId: row.organization_id,
    name: row.name,
    subject: row.subject ?? row.name,
    language: row.language,
    frequency: row.frequency,
    sendDay: row.send_day,
    sendHour: row.send_hour,
    timezone: row.timezone,
    recipients,
    mode: row.mode === "advanced" ? "advanced" : "common",
    nlQuery: row.nl_query ?? "",
    sections,
    maxItems: row.max_items,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

const SELECT =
  "*, mc_bulletin_sections(title, companies, technologies, sort_order), mc_bulletin_recipients(email, companies, technologies)";

export async function listBulletinsForUser(
  userId: string,
  organizationId: string | null,
  canSeeOrg: boolean,
): Promise<StoredBulletin[]> {
  if (!isSupabaseConfigured()) {
    return listLocal(userId, organizationId, canSeeOrg);
  }
  const supabase = createClient();
  let query = supabase.from("mc_bulletins").select(SELECT).order("updated_at", { ascending: false });
  if (canSeeOrg && organizationId) {
    query = query.eq("organization_id", organizationId);
  } else {
    query = query.eq("created_by", userId);
  }
  const { data, error } = await query;
  if (error) {
    console.warn("mc_bulletins list failed", error.message);
    return listLocal(userId, organizationId, canSeeOrg);
  }
  return (data as BulletinRow[] | null)?.map(mapRow) ?? [];
}

export async function getBulletin(id: string): Promise<StoredBulletin | undefined> {
  if (!isSupabaseConfigured()) {
    return getLocal(id);
  }
  const supabase = createClient();
  const { data, error } = await supabase.from("mc_bulletins").select(SELECT).eq("id", id).maybeSingle();
  if (error) {
    console.warn("mc_bulletins get failed", error.message);
    return getLocal(id);
  }
  return data ? mapRow(data as BulletinRow) : undefined;
}

export async function saveBulletin(
  input: StoredBulletin,
  opts?: { plan?: PlanType | null },
): Promise<StoredBulletin> {
  const next = normalizeBulletin({ ...input, updatedAt: new Date().toISOString() });
  const cap = maxActiveBulletins(opts?.plan);
  if (next.status === "active" && cap != null) {
    const active = await countActiveBulletins(next.createdBy);
    const existing = await getBulletin(next.id);
    const alreadyActive = existing?.status === "active";
    if (!alreadyActive && active >= cap) {
      throw new BulletinCapError();
    }
  }
  if (!isSupabaseConfigured()) {
    return saveLocal(next);
  }

  const supabase = createClient();
  const { error: upsertError } = await supabase.from("mc_bulletins").upsert(
    {
      id: next.id,
      organization_id: next.organizationId,
      created_by: next.createdBy,
      name: next.name,
      subject: next.subject,
      language: next.language,
      frequency: next.frequency,
      send_day: next.sendDay,
      send_hour: next.sendHour,
      timezone: next.timezone,
      nl_query: next.nlQuery || null,
      mode: next.mode,
      status: next.status,
      max_items: next.maxItems,
      updated_at: next.updatedAt,
      created_at: next.createdAt,
    },
    { onConflict: "id" },
  );
  if (upsertError) {
    console.warn("mc_bulletins upsert failed", upsertError.message);
    return saveLocal(next);
  }

  await supabase.from("mc_bulletin_sections").delete().eq("bulletin_id", next.id);
  await supabase.from("mc_bulletin_recipients").delete().eq("bulletin_id", next.id);

  if (next.sections.length) {
    const { error: secErr } = await supabase.from("mc_bulletin_sections").insert(
      next.sections.map((s, i) => ({
        bulletin_id: next.id,
        title: s.title,
        companies: s.companies,
        competitors: [] as string[],
        technologies: s.technologies,
        sort_order: i,
      })),
    );
    if (secErr) console.warn("mc_bulletin_sections insert failed", secErr.message);
  }

  if (next.recipients.length) {
    const { error: recErr } = await supabase.from("mc_bulletin_recipients").insert(
      next.recipients.map((r) => ({
        bulletin_id: next.id,
        email: r.email,
        companies: r.companies,
        technologies: r.technologies,
      })),
    );
    if (recErr) console.warn("mc_bulletin_recipients insert failed", recErr.message);
  }

  // Keep local mirror for offline/demo resilience
  try {
    saveLocal(next);
  } catch {
    /* ignore */
  }
  return next;
}

export async function deleteBulletin(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    deleteLocal(id);
    return;
  }
  const supabase = createClient();
  const { error } = await supabase.from("mc_bulletins").delete().eq("id", id);
  if (error) console.warn("mc_bulletins delete failed", error.message);
  try {
    deleteLocal(id);
  } catch {
    /* ignore */
  }
}

export async function countActiveBulletins(userId: string): Promise<number> {
  const items = await listBulletinsForUser(userId, null, false);
  return items.filter((b) => b.createdBy === userId && b.status === "active").length;
}
