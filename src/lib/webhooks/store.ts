import { isSupabaseConfigured, createClient } from "@/lib/supabase/client";
import { readMigratedStorage, writeStorage } from "@/lib/storage-keys";

export type WebhookEndpoint = {
  id: string;
  organizationId: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

const KEY = "menoska_webhooks";
const memory: WebhookEndpoint[] = [];

function readLocal(): WebhookEndpoint[] {
  if (typeof window === "undefined") return [...memory];
  try {
    const raw = readMigratedStorage(KEY, "abi_webhooks");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WebhookEndpoint[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(items: WebhookEndpoint[]) {
  if (typeof window === "undefined") {
    memory.length = 0;
    memory.push(...items);
    return;
  }
  writeStorage(KEY, JSON.stringify(items));
}

export async function listWebhooksForOrg(organizationId: string): Promise<WebhookEndpoint[]> {
  if (isSupabaseConfigured()) {
    try {
      if (typeof window !== "undefined") {
        const supabase = createClient();
        const { data, error } = await supabase.from("mc_webhooks").select("*").eq("organization_id", organizationId);
        if (!error && data) {
          return data.map((row) => mapRow(row as Record<string, unknown>));
        }
      } else {
        const { createServerSupabase } = await import("@/lib/supabase/server");
        const { createAdminSupabase } = await import("@/lib/supabase/admin");
        const supabase = (await createServerSupabase()) ?? createAdminSupabase();
        if (supabase) {
          const { data, error } = await supabase.from("mc_webhooks").select("*").eq("organization_id", organizationId);
          if (!error && data) {
            return data.map((row) => mapRow(row as Record<string, unknown>));
          }
        }
      }
    } catch {
      /* fall through */
    }
  }
  return readLocal().filter((w) => w.organizationId === organizationId);
}

export async function upsertWebhook(endpoint: WebhookEndpoint): Promise<WebhookEndpoint> {
  if (isSupabaseConfigured() && typeof window !== "undefined") {
    const supabase = createClient();
    const { error } = await supabase.from("mc_webhooks").upsert({
      id: endpoint.id,
      organization_id: endpoint.organizationId,
      url: endpoint.url,
      secret: endpoint.secret,
      events: endpoint.events,
      active: endpoint.active,
      updated_at: endpoint.updatedAt,
      created_at: endpoint.createdAt,
    });
    if (!error) return endpoint;
    console.warn("mc_webhooks upsert failed", error.message);
  }
  const all = readLocal().filter((w) => w.id !== endpoint.id);
  all.push(endpoint);
  writeLocal(all);
  return endpoint;
}

export async function deleteWebhook(id: string, organizationId: string): Promise<void> {
  if (isSupabaseConfigured() && typeof window !== "undefined") {
    const supabase = createClient();
    const { error } = await supabase.from("mc_webhooks").delete().eq("id", id).eq("organization_id", organizationId);
    if (!error) return;
    console.warn("mc_webhooks delete failed", error.message);
  }
  writeLocal(readLocal().filter((w) => !(w.id === id && w.organizationId === organizationId)));
}

function mapRow(row: Record<string, unknown>): WebhookEndpoint {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    url: String(row.url),
    secret: String(row.secret ?? ""),
    events: Array.isArray(row.events) ? (row.events as string[]) : ["bulletin.sent"],
    active: Boolean(row.active ?? true),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}
