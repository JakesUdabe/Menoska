import { createHash, randomBytes } from "crypto";
import { readMigratedStorage, writeStorage } from "@/lib/storage-keys";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export type ApiKeyRecord = {
  id: string;
  organizationId: string;
  name: string;
  /** sha256 hex of the raw key — never store plaintext */
  keyHash: string;
  /** First 8 chars after mk_ for UI display */
  prefix: string;
  createdBy: string;
  createdAt: string;
  lastUsedAt: string | null;
  active: boolean;
};

const KEY = "menoska_api_keys";
/** Server-side demo memory (shared within process). */
const memory: ApiKeyRecord[] = [];

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey, "utf8").digest("hex");
}

/** Opaque key: `mk_` + 32 hex chars. */
export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const raw = `mk_${randomBytes(16).toString("hex")}`;
  return { raw, hash: hashApiKey(raw), prefix: raw.slice(0, 11) };
}

export function isApiKeyBearer(token: string): boolean {
  return token.startsWith("mk_");
}

function readLocal(): ApiKeyRecord[] {
  if (typeof window === "undefined") return [...memory];
  try {
    const raw = readMigratedStorage(KEY, "abi_api_keys");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ApiKeyRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(items: ApiKeyRecord[]) {
  if (typeof window === "undefined") {
    memory.length = 0;
    memory.push(...items);
    return;
  }
  writeStorage(KEY, JSON.stringify(items));
  // Mirror into memory so same-process API routes can resolve demo keys
  memory.length = 0;
  memory.push(...items);
}

export function listApiKeysLocal(organizationId: string): ApiKeyRecord[] {
  return readLocal().filter((k) => k.organizationId === organizationId && k.active);
}

export function upsertApiKeyLocal(record: ApiKeyRecord): ApiKeyRecord {
  const all = readLocal().filter((k) => k.id !== record.id);
  all.push(record);
  writeLocal(all);
  return record;
}

export function revokeApiKeyLocal(id: string, organizationId: string): void {
  writeLocal(
    readLocal().map((k) =>
      k.id === id && k.organizationId === organizationId ? { ...k, active: false } : k,
    ),
  );
}

/** Resolve org + user from a raw `mk_…` bearer (demo memory or Supabase). */
export async function resolveApiKeyBearer(
  rawKey: string,
): Promise<{ userId: string; organizationId: string; demo: boolean } | null> {
  if (!isApiKeyBearer(rawKey)) return null;
  const keyHash = hashApiKey(rawKey);

  const local = [...memory, ...readLocal()].find((k) => k.keyHash === keyHash && k.active);
  if (local) {
    return { userId: local.createdBy, organizationId: local.organizationId, demo: true };
  }

  if (!isSupabaseConfigured()) return null;

  try {
    const { createAdminSupabase } = await import("@/lib/supabase/admin");
    const { createServerSupabase } = await import("@/lib/supabase/server");
    const client = createAdminSupabase() ?? (await createServerSupabase());
    if (!client) return null;
    const { data, error } = await client
      .from("mc_api_keys")
      .select("id, organization_id, created_by, active")
      .eq("key_hash", keyHash)
      .eq("active", true)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as {
      id: string;
      organization_id: string;
      created_by: string;
      active: boolean;
    };
    void client
      .from("mc_api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", row.id);
    return {
      userId: row.created_by,
      organizationId: row.organization_id,
      demo: false,
    };
  } catch {
    return null;
  }
}

export async function listApiKeysForOrg(organizationId: string): Promise<ApiKeyRecord[]> {
  if (isSupabaseConfigured()) {
    try {
      if (typeof window !== "undefined") {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data, error } = await supabase
          .from("mc_api_keys")
          .select("id, organization_id, name, key_hash, prefix, created_by, created_at, last_used_at, active")
          .eq("organization_id", organizationId)
          .eq("active", true);
        if (!error && data) {
          return data.map(mapRow);
        }
      } else {
        const { createServerSupabase } = await import("@/lib/supabase/server");
        const { createAdminSupabase } = await import("@/lib/supabase/admin");
        const supabase = (await createServerSupabase()) ?? createAdminSupabase();
        if (supabase) {
          const { data, error } = await supabase
            .from("mc_api_keys")
            .select("id, organization_id, name, key_hash, prefix, created_by, created_at, last_used_at, active")
            .eq("organization_id", organizationId)
            .eq("active", true);
          if (!error && data) return data.map(mapRow);
        }
      }
    } catch {
      /* fall through */
    }
  }
  return listApiKeysLocal(organizationId);
}

function mapRow(row: Record<string, unknown>): ApiKeyRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name ?? "key"),
    keyHash: String(row.key_hash ?? ""),
    prefix: String(row.prefix ?? "mk_"),
    createdBy: String(row.created_by ?? ""),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    lastUsedAt: row.last_used_at ? String(row.last_used_at) : null,
    active: Boolean(row.active ?? true),
  };
}
