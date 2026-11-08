import { isSupabaseConfigured, createClient } from "@/lib/supabase/client";
import { readMigratedStorage, writeStorage } from "@/lib/storage-keys";

export type ActivityEvent = {
  id: string;
  organizationId: string | null;
  userId: string | null;
  kind: string;
  title: string;
  meta: Record<string, unknown>;
  createdAt: string;
};

const KEY = "menoska_activity";

function readLocal(): ActivityEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = readMigratedStorage(KEY, "abi_activity");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ActivityEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(events: ActivityEvent[]) {
  writeStorage(KEY, JSON.stringify(events.slice(0, 100)));
}

export async function recordActivity(input: {
  organizationId?: string | null;
  userId?: string | null;
  kind: string;
  title: string;
  meta?: Record<string, unknown>;
}): Promise<ActivityEvent> {
  const event: ActivityEvent = {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `act-${Date.now()}`,
    organizationId: input.organizationId ?? null,
    userId: input.userId ?? null,
    kind: input.kind,
    title: input.title,
    meta: input.meta ?? {},
    createdAt: new Date().toISOString(),
  };

  try {
    const local = readLocal();
    local.unshift(event);
    writeLocal(local);
  } catch {
    /* ignore */
  }

  if (typeof window !== "undefined" && isSupabaseConfigured() && input.userId) {
    try {
      const supabase = createClient();
      const { error } = await supabase.from("mc_activity_events").insert({
        id: event.id,
        organization_id: event.organizationId,
        user_id: event.userId,
        kind: event.kind,
        title: event.title,
        meta: event.meta,
        created_at: event.createdAt,
      });
      if (error) console.warn("mc_activity_events insert failed", error.message);
    } catch (err) {
      console.warn("recordActivity supabase failed", err);
    }
  }

  return event;
}

export async function listRecentActivity(opts: {
  organizationId?: string | null;
  userId?: string | null;
  limit?: number;
}): Promise<ActivityEvent[]> {
  const limit = opts.limit ?? 5;

  if (typeof window !== "undefined" && isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      let query = supabase
        .from("mc_activity_events")
        .select("id, organization_id, user_id, kind, title, meta, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (opts.organizationId) {
        query = query.eq("organization_id", opts.organizationId);
      } else if (opts.userId) {
        query = query.eq("user_id", opts.userId);
      }
      const { data, error } = await query;
      if (!error && data?.length) {
        return data.map((row) => ({
          id: row.id as string,
          organizationId: (row.organization_id as string | null) ?? null,
          userId: (row.user_id as string | null) ?? null,
          kind: row.kind as string,
          title: row.title as string,
          meta: (row.meta as Record<string, unknown>) ?? {},
          createdAt: row.created_at as string,
        }));
      }
      if (error) console.warn("mc_activity_events list failed", error.message);
    } catch (err) {
      console.warn("listRecentActivity supabase failed", err);
    }
  }

  let local = readLocal();
  if (opts.organizationId) {
    local = local.filter((e) => e.organizationId === opts.organizationId);
  } else if (opts.userId) {
    local = local.filter((e) => e.userId === opts.userId);
  }
  return local.slice(0, limit);
}
