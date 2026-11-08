import { isSupabaseConfigured, createClient } from "@/lib/supabase/client";
import { readMigratedStorage, writeStorage } from "@/lib/storage-keys";
import type { ActivityEvent } from "@/lib/activity";

export type AuditEvent = ActivityEvent & { kind: `audit.${string}` };

const KEY = "menoska_audit";
const MAX = 200;

/** Server-side demo buffer (API routes cannot touch localStorage). */
const memoryAudit: AuditEvent[] = [];

function readLocal(): AuditEvent[] {
  if (typeof window === "undefined") return [...memoryAudit];
  try {
    const raw = readMigratedStorage(KEY, "abi_audit");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AuditEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(events: AuditEvent[]) {
  if (typeof window === "undefined") {
    memoryAudit.length = 0;
    memoryAudit.push(...events.slice(0, MAX));
    return;
  }
  writeStorage(KEY, JSON.stringify(events.slice(0, MAX)));
}

function actionToTitle(action: string, meta: Record<string, unknown>): string {
  switch (action) {
    case "plan_change":
      return `Cambio de plan → ${String(meta.plan ?? meta.to ?? "")}`;
    case "invite_create":
      return `Invitación creada: ${String(meta.email ?? "")}`;
    case "invite_accept":
      return `Invitación aceptada: ${String(meta.email ?? "")}`;
    case "bulletin_send":
      return `Boletín enviado: ${String(meta.bulletinName ?? meta.bulletinId ?? "")}`;
    case "org_update":
      return `Organización actualizada: ${String(meta.name ?? meta.orgId ?? "")}`;
    default:
      return `Auditoría: ${action}`;
  }
}

async function insertActivityRow(event: AuditEvent): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const row = {
    id: event.id,
    organization_id: event.organizationId,
    user_id: event.userId,
    kind: event.kind,
    title: event.title,
    meta: event.meta,
    created_at: event.createdAt,
  };

  try {
    if (typeof window === "undefined") return;
    const supabase = createClient();
    const { error } = await supabase.from("mc_activity_events").insert(row);
    if (error) console.warn("mc_activity_events audit insert failed", error.message);
  } catch (err) {
    console.warn("logAudit supabase failed", err);
  }
}

/** Persist an audit event (kind = `audit.${action}`). Dual-mode: local/memory + optional `mc_activity_events`. */
export async function logAudit(input: {
  actorId: string | null;
  orgId: string | null;
  action: string;
  meta?: Record<string, unknown>;
}): Promise<AuditEvent> {
  const action = input.action.replace(/^audit\./, "");
  const meta = input.meta ?? {};
  const event: AuditEvent = {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `audit-${Date.now()}`,
    organizationId: input.orgId,
    userId: input.actorId,
    kind: `audit.${action}`,
    title: actionToTitle(action, meta),
    meta,
    createdAt: new Date().toISOString(),
  };

  try {
    const local = readLocal();
    local.unshift(event);
    writeLocal(local);
  } catch {
    /* ignore */
  }

  await insertActivityRow(event);
  return event;
}

/** List audit.* events for admin auditoría page. */
export async function listAuditEvents(opts: {
  organizationId?: string | null;
  limit?: number;
}): Promise<AuditEvent[]> {
  const limit = opts.limit ?? 50;

  if (typeof window !== "undefined" && isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      let query = supabase
        .from("mc_activity_events")
        .select("id, organization_id, user_id, kind, title, meta, created_at")
        .like("kind", "audit.%")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (opts.organizationId) {
        query = query.eq("organization_id", opts.organizationId);
      }
      const { data, error } = await query;
      if (!error && data?.length) {
        return data.map((row) => ({
          id: row.id as string,
          organizationId: (row.organization_id as string | null) ?? null,
          userId: (row.user_id as string | null) ?? null,
          kind: row.kind as `audit.${string}`,
          title: row.title as string,
          meta: (row.meta as Record<string, unknown>) ?? {},
          createdAt: row.created_at as string,
        }));
      }
      if (error) console.warn("mc_activity_events audit list failed", error.message);
    } catch (err) {
      console.warn("listAuditEvents supabase failed", err);
    }
  }

  let local = readLocal().filter((e) => e.kind.startsWith("audit."));
  // Merge server memory buffer when listing on client in same process (tests / SSR)
  if (typeof window !== "undefined" && memoryAudit.length) {
    const ids = new Set(local.map((e) => e.id));
    for (const e of memoryAudit) {
      if (!ids.has(e.id) && e.kind.startsWith("audit.")) local.push(e);
    }
    local.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  if (opts.organizationId) {
    local = local.filter((e) => e.organizationId === opts.organizationId);
  }
  return local.slice(0, limit);
}
