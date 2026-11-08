import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAuthWithPlan } from "@/lib/api/plan-guard";
import { deleteWebhook, listWebhooksForOrg, upsertWebhook, type WebhookEndpoint } from "@/lib/webhooks/store";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

const createSchema = z.object({
  url: z.string().url(),
  secret: z.string().max(200).optional(),
  events: z.array(z.string()).min(1).default(["bulletin.sent"]),
  active: z.boolean().optional(),
});

export async function GET(request: Request) {
  const auth = await requireApiAuthWithPlan(request, "v1-webhooks");
  if (!auth.ok) return auth.response;
  if (!auth.organizationId) {
    return NextResponse.json({ error: "organization_required" }, { status: 400 });
  }
  const items = await listWebhooksForOrg(auth.organizationId);
  return NextResponse.json({
    items: items.map((w) => ({
      id: w.id,
      url: w.url,
      events: w.events,
      active: w.active,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
      hasSecret: Boolean(w.secret),
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireApiAuthWithPlan(request, "v1-webhooks");
  if (!auth.ok) return auth.response;
  if (!auth.organizationId) {
    return NextResponse.json({ error: "organization_required" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const now = new Date().toISOString();
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `wh_${Date.now()}`;

  const endpoint: WebhookEndpoint = {
    id,
    organizationId: auth.organizationId,
    url: parsed.data.url,
    secret: parsed.data.secret ?? "",
    events: parsed.data.events,
    active: parsed.data.active ?? true,
    createdAt: now,
    updatedAt: now,
  };

  if (isSupabaseConfigured() && typeof window === "undefined") {
    const supabase = (await createServerSupabase()) ?? createAdminSupabase();
    if (supabase) {
      const { error } = await supabase.from("mc_webhooks").insert({
        id: endpoint.id,
        organization_id: endpoint.organizationId,
        url: endpoint.url,
        secret: endpoint.secret,
        events: endpoint.events,
        active: endpoint.active,
        created_at: endpoint.createdAt,
        updated_at: endpoint.updatedAt,
      });
      if (error) console.warn("mc_webhooks insert failed", error.message);
      else return NextResponse.json({ ok: true, id: endpoint.id });
    }
  }

  await upsertWebhook(endpoint);
  return NextResponse.json({ ok: true, id: endpoint.id });
}

export async function DELETE(request: Request) {
  const auth = await requireApiAuthWithPlan(request, "v1-webhooks");
  if (!auth.ok) return auth.response;
  if (!auth.organizationId) {
    return NextResponse.json({ error: "organization_required" }, { status: 400 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });

  if (isSupabaseConfigured()) {
    const supabase = (await createServerSupabase()) ?? createAdminSupabase();
    if (supabase) {
      await supabase.from("mc_webhooks").delete().eq("id", id).eq("organization_id", auth.organizationId);
    }
  }
  await deleteWebhook(id, auth.organizationId);
  return NextResponse.json({ ok: true });
}
