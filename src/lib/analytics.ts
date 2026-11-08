import { isSupabaseConfigured } from "@/lib/supabase/client";
import { readMigratedStorage, writeStorage } from "@/lib/storage-keys";

export type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

export type AnalyticsBufferEvent = {
  event: string;
  props: AnalyticsProps;
  at: string;
};

const BUFFER_KEY = "menoska_analytics_buffer";
const memoryBuffer: AnalyticsBufferEvent[] = [];
const MAX_BUFFER = 200;

function pushBuffer(entry: AnalyticsBufferEvent) {
  memoryBuffer.unshift(entry);
  if (memoryBuffer.length > MAX_BUFFER) memoryBuffer.length = MAX_BUFFER;
  if (typeof window === "undefined") return;
  try {
    const prev = listLocalAnalyticsBuffer();
    prev.unshift(entry);
    writeStorage(BUFFER_KEY, JSON.stringify(prev.slice(0, MAX_BUFFER)));
  } catch {
    /* ignore */
  }
}

/** Recent events from demo localStorage + process memory (for admin analytics). */
export function listLocalAnalyticsBuffer(limit = 100): AnalyticsBufferEvent[] {
  const fromMemory = [...memoryBuffer];
  if (typeof window === "undefined") return fromMemory.slice(0, limit);
  try {
    const raw = readMigratedStorage(BUFFER_KEY, "abi_analytics_buffer");
    if (!raw) return fromMemory.slice(0, limit);
    const parsed = JSON.parse(raw) as AnalyticsBufferEvent[];
    if (!Array.isArray(parsed)) return fromMemory.slice(0, limit);
    const merged = [...parsed, ...fromMemory];
    const seen = new Set<string>();
    const out: AnalyticsBufferEvent[] = [];
    for (const e of merged) {
      const k = `${e.at}:${e.event}:${JSON.stringify(e.props)}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(e);
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return fromMemory.slice(0, limit);
  }
}

export function countAnalyticsByEvent(events: AnalyticsBufferEvent[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of events) {
    counts[e.event] = (counts[e.event] ?? 0) + 1;
  }
  return counts;
}

/**
 * Product analytics stub (Hito 1).
 * Demo / no Supabase → local buffer + console.debug. With Supabase → best-effort insert into mc_analytics_events.
 */
export async function track(event: string, props: AnalyticsProps = {}): Promise<void> {
  const payload: AnalyticsBufferEvent = {
    event,
    props,
    at: new Date().toISOString(),
  };

  pushBuffer(payload);

  if (!isSupabaseConfigured()) {
    if (typeof console !== "undefined" && console.debug) {
      console.debug("[analytics]", payload);
    }
    return;
  }

  try {
    const cleanProps: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(props)) {
      if (v !== undefined) cleanProps[k] = v;
    }

    if (typeof window === "undefined") {
      console.debug("[analytics]", payload);
      return;
    }

    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    let organizationId: string | null = null;
    if (user) {
      const { data: profile } = await supabase
        .from("mc_profiles")
        .select("organization_id")
        .eq("id", user.id)
        .maybeSingle();
      organizationId = (profile as { organization_id?: string } | null)?.organization_id ?? null;
    }
    const { error } = await supabase.from("mc_analytics_events").insert({
      event,
      props: cleanProps,
      user_id: user?.id ?? null,
      organization_id: organizationId,
    });
    if (error) console.warn("[analytics] insert failed", error.message);
  } catch (err) {
    console.warn("[analytics] error", err instanceof Error ? err.message : err);
  }
}
