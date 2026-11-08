import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAuthWithPlan } from "@/lib/api/plan-guard";
import { isOrgAdmin } from "@/lib/rbac";
import { DEMO_PROFILES } from "@/lib/demo-data";
import {
  generateApiKey,
  listApiKeysForOrg,
  revokeApiKeyLocal,
  upsertApiKeyLocal,
  type ApiKeyRecord,
} from "@/lib/api-keys";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

const createSchema = z.object({
  name: z.string().min(1).max(80).optional(),
});

async function callerIsOrgAdmin(userId: string, demo: boolean): Promise<boolean> {
  if (demo) {
    const profile = DEMO_PROFILES.find((p) => p.id === userId);
    return isOrgAdmin(profile?.role);
  }
  const supabase = await createServerSupabase();
  if (!supabase) return false;
  const { data } = await supabase.from("mc_profiles").select("role").eq("id", userId).maybeSingle();
  return isOrgAdmin((data as { role?: string } | null)?.role);
}

export async function GET(request: Request) {
  const auth = await requireApiAuthWithPlan(request, "v1-keys");
  if (!auth.ok) return auth.response;
  if (!auth.organizationId) {
    return NextResponse.json({ error: "organization_required" }, { status: 400 });
  }
  if (!(await callerIsOrgAdmin(auth.userId, auth.demo))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const items = await listApiKeysForOrg(auth.organizationId);
  return NextResponse.json({
    items: items.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
      active: k.active,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireApiAuthWithPlan(request, "v1-keys");
  if (!auth.ok) return auth.response;
  if (!auth.organizationId) {
    return NextResponse.json({ error: "organization_required" }, { status: 400 });
  }
  if (!(await callerIsOrgAdmin(auth.userId, auth.demo))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const { raw, hash, prefix } = generateApiKey();
  const now = new Date().toISOString();
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `key_${Date.now()}`;

  const record: ApiKeyRecord = {
    id,
    organizationId: auth.organizationId,
    name: parsed.data.name ?? "default",
    keyHash: hash,
    prefix,
    createdBy: auth.userId,
    createdAt: now,
    lastUsedAt: null,
    active: true,
  };

  if (isSupabaseConfigured()) {
    const supabase = (await createServerSupabase()) ?? createAdminSupabase();
    if (supabase) {
      const { error } = await supabase.from("mc_api_keys").insert({
        id: record.id,
        organization_id: record.organizationId,
        name: record.name,
        key_hash: record.keyHash,
        prefix: record.prefix,
        created_by: record.createdBy,
        created_at: record.createdAt,
        active: true,
      });
      if (error) console.warn("mc_api_keys insert failed", error.message);
    }
  }

  upsertApiKeyLocal(record);

  // Raw key returned once only
  return NextResponse.json({
    ok: true,
    id: record.id,
    prefix: record.prefix,
    key: raw,
    warning: "copy_now_shown_once",
  });
}

export async function DELETE(request: Request) {
  const auth = await requireApiAuthWithPlan(request, "v1-keys");
  if (!auth.ok) return auth.response;
  if (!auth.organizationId) {
    return NextResponse.json({ error: "organization_required" }, { status: 400 });
  }
  if (!(await callerIsOrgAdmin(auth.userId, auth.demo))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });

  if (isSupabaseConfigured()) {
    const supabase = (await createServerSupabase()) ?? createAdminSupabase();
    if (supabase) {
      await supabase
        .from("mc_api_keys")
        .update({ active: false })
        .eq("id", id)
        .eq("organization_id", auth.organizationId);
    }
  }
  revokeApiKeyLocal(id, auth.organizationId);
  return NextResponse.json({ ok: true });
}
