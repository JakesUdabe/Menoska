import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAuth } from "@/lib/api/guard";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { sendBulletinById } from "@/lib/bulletins/send-service";
import type { StoredBulletin } from "@/lib/bulletins-store";
import { recordActivity } from "@/lib/activity";
import { logAudit } from "@/lib/audit-server";
import { track } from "@/lib/analytics-server";
import { dispatchWebhooks } from "@/lib/webhooks/dispatch";

const schema = z.object({
  bulletinId: z.string().min(1),
  bulletin: z
    .object({
      id: z.string(),
      name: z.string(),
      subject: z.string(),
      language: z.string().optional(),
      recipients: z
        .array(
          z.object({
            email: z.string(),
            companies: z.array(z.string()).optional(),
            technologies: z.array(z.string()).optional(),
          }),
        )
        .optional(),
      sections: z
        .array(z.object({ title: z.string().optional(), companies: z.array(z.string()), technologies: z.array(z.string()) }))
        .optional(),
      maxItems: z.number().optional(),
      organizationId: z.string().optional(),
      mode: z.enum(["common", "advanced"]).optional(),
      nlQuery: z.string().optional(),
      createdBy: z.string().optional(),
      frequency: z.string().optional(),
      sendDay: z.number().nullable().optional(),
      sendHour: z.number().optional(),
      timezone: z.string().optional(),
      status: z.string().optional(),
      createdAt: z.string().optional(),
      updatedAt: z.string().optional(),
    })
    .optional(),
  orgName: z.string().optional(),
});

function toStored(raw: NonNullable<z.infer<typeof schema>["bulletin"]>): StoredBulletin {
  return {
    id: raw.id,
    createdBy: raw.createdBy ?? "unknown",
    organizationId: raw.organizationId ?? "org-unknown",
    name: raw.name,
    subject: raw.subject,
    language: raw.language ?? "es",
    frequency: (raw.frequency as StoredBulletin["frequency"]) ?? "weekly",
    sendDay: raw.sendDay ?? 1,
    sendHour: raw.sendHour ?? 7,
    timezone: raw.timezone ?? "UTC",
    recipients: (raw.recipients ?? []).map((r) => ({
      email: r.email,
      companies: r.companies ?? [],
      technologies: r.technologies ?? [],
    })),
    mode: raw.mode ?? "common",
    nlQuery: raw.nlQuery ?? "",
    sections: (raw.sections as StoredBulletin["sections"]) ?? [{ title: "Sección 1", companies: [], technologies: [] }],
    maxItems: raw.maxItems ?? 10,
    status: (raw.status as StoredBulletin["status"]) ?? "draft",
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
  };
}

export async function POST(request: Request) {
  const auth = await requireApiAuth(request, "bulletins-send");
  if (!auth.ok) return auth.response;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  // Production: never trust client bulletin payload — load by id. Demo may send body.
  const override =
    !isSupabaseConfigured() && parsed.data.bulletin ? toStored(parsed.data.bulletin) : undefined;

  const result = await sendBulletinById({
    bulletinId: parsed.data.bulletinId,
    bulletinOverride: override,
    orgName: parsed.data.orgName,
    userId: auth.userId,
  });

  const orgId = override?.organizationId ?? null;

  if (!result.ok) {
    try {
      await recordActivity({
        organizationId: orgId,
        userId: auth.userId,
        kind: "delivery_failed",
        title: `Fallo de envío: ${parsed.data.bulletinId}`,
        meta: { bulletinId: parsed.data.bulletinId, error: result.error },
      });
      const { pushNotification } = await import("@/lib/notifications-store");
      pushNotification({
        organizationId: orgId,
        userId: auth.userId,
        kind: "delivery_failed",
        title: `Envío fallido tras reintentos`,
        body: result.error,
      });
      void track("bulletin_send_failed", {
        userId: auth.userId,
        organizationId: orgId,
        bulletinId: parsed.data.bulletinId,
        error: result.error,
      });
    } catch {
      /* best-effort */
    }
    return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
  }

  try {
    await recordActivity({
      organizationId: orgId,
      userId: auth.userId,
      kind: "bulletin_sent",
      title: `Boletín enviado: ${result.delivery.bulletinName}`,
      meta: {
        bulletinId: result.delivery.bulletinId,
        itemCount: result.itemCount,
        demo: result.demo,
      },
    });
    await logAudit({
      actorId: auth.userId,
      orgId,
      action: "bulletin_send",
      meta: {
        bulletinId: result.delivery.bulletinId,
        bulletinName: result.delivery.bulletinName,
        itemCount: result.itemCount,
        demo: result.demo,
      },
    });
    void track("bulletin_send", {
      userId: auth.userId,
      organizationId: orgId,
      bulletinId: result.delivery.bulletinId,
      demo: result.demo,
      itemCount: result.itemCount,
    });
    void dispatchWebhooks({
      organizationId: orgId,
      event: "bulletin.sent",
      payload: {
        bulletinId: result.delivery.bulletinId,
        bulletinName: result.delivery.bulletinName,
        itemCount: result.itemCount,
        demo: result.demo,
      },
    });
  } catch {
    /* best-effort */
  }

  return NextResponse.json({
    ok: true,
    demo: result.demo,
    id: result.id,
    itemCount: result.itemCount,
    delivery: result.delivery,
  });
}
