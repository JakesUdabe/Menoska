import { NextResponse } from "next/server";
import { z } from "zod";
import { recordActivity } from "@/lib/activity";
import { logAudit } from "@/lib/audit-server";
import { acceptInvite } from "@/lib/invites-repository";
import { requireApiAuth } from "@/lib/api/guard";
import { isSupabaseConfigured } from "@/lib/supabase/client";

const schema = z.object({
  token: z.string().min(8),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  password: z.string().optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  let userId: string | undefined;
  if (isSupabaseConfigured()) {
    const auth = await requireApiAuth(request, "invites-accept");
    if (!auth.ok) return auth.response;
    userId = auth.userId;
  }

  try {
    const result = await acceptInvite({
      token: parsed.data.token,
      userId,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      password: parsed.data.password,
    });
    try {
      await recordActivity({
        organizationId: result.invite.organizationId,
        userId: userId ?? null,
        kind: "invite_accepted",
        title: `Invitación aceptada: ${result.invite.email}`,
        meta: {
          inviteId: result.invite.id,
          role: result.invite.role,
          email: result.invite.email,
        },
      });
      await logAudit({
        actorId: userId ?? null,
        orgId: result.invite.organizationId,
        action: "invite_accept",
        meta: {
          inviteId: result.invite.id,
          role: result.invite.role,
          email: result.invite.email,
        },
      });
    } catch {
      /* best-effort */
    }
    return NextResponse.json({
      ok: true,
      invite: {
        email: result.invite.email,
        organizationId: result.invite.organizationId,
        organizationName: result.invite.organizationName,
        role: result.invite.role,
      },
      demoAccount: result.demoAccount ?? null,
      demo: !isSupabaseConfigured(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "invite_accept_failed";
    const status = message === "invite_invalid" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
