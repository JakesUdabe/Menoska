import { NextResponse } from "next/server";
import { z } from "zod";
import { recordActivity } from "@/lib/activity";
import { logAudit } from "@/lib/audit-server";
import { requireApiAuthWithPlan } from "@/lib/api/plan-guard";
import { createInvite, getInviteByToken, listPendingInvitesForOrg } from "@/lib/invites-repository";
import { APP_ROLES, canManageOrgUsers, isAppRole } from "@/lib/rbac";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createServerSupabase } from "@/lib/supabase/server";
import { DEMO_PROFILES } from "@/lib/demo-data";

const createSchema = z.object({
  email: z.string().email(),
  role: z.enum(APP_ROLES).default("client"),
  organizationId: z.string().optional(),
  organizationName: z.string().optional(),
});

async function resolveAdminContext(request: Request, userId: string, demo: boolean) {
  if (demo) {
    const profile = DEMO_PROFILES.find((p) => p.id === userId);
    const headerRole = request.headers.get("x-demo-role")?.trim();
    const headerOrg = request.headers.get("x-demo-org-id")?.trim();
    const role = profile?.role ?? (isAppRole(headerRole) ? headerRole : "client");
    return {
      role,
      organizationId: profile?.organizationId ?? headerOrg ?? null,
      organizationName: profile?.organizationName,
    };
  }
  const supabase = await createServerSupabase();
  if (!supabase) return { role: "client" as const, organizationId: null as string | null, organizationName: undefined };
  const { data } = await supabase
    .from("mc_profiles")
    .select("role, organization_id, mc_organizations!mc_profiles_organization_id_fkey(name)")
    .eq("id", userId)
    .maybeSingle();
  const org = (
    data as {
      role?: string;
      organization_id?: string | null;
      mc_organizations?: { name?: string } | { name?: string }[] | null;
    } | null
  )?.mc_organizations;
  const orgObj = Array.isArray(org) ? org[0] : org;
  return {
    role: (data?.role as string) ?? "client",
    organizationId: (data as { organization_id?: string | null } | null)?.organization_id ?? null,
    organizationName: orgObj?.name,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim();
  if (token) {
    const invite = await getInviteByToken(token);
    if (!invite) return NextResponse.json({ error: "invite_invalid" }, { status: 404 });
    return NextResponse.json({
      email: invite.email,
      role: invite.role,
      organizationName: invite.organizationName ?? null,
      expiresAt: invite.expiresAt,
      token: invite.token,
    });
  }

  const auth = await requireApiAuthWithPlan(request, "invites");
  if (!auth.ok) return auth.response;
  const ctx = await resolveAdminContext(request, auth.userId, auth.demo);
  if (!canManageOrgUsers(ctx.role) || !ctx.organizationId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const invites = await listPendingInvitesForOrg(ctx.organizationId);
  return NextResponse.json({ invites });
}

export async function POST(request: Request) {
  const auth = await requireApiAuthWithPlan(request, "invites-create");
  if (!auth.ok) return auth.response;

  const ctx = await resolveAdminContext(request, auth.userId, auth.demo);
  if (!canManageOrgUsers(ctx.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const organizationId =
    (auth.demo ? parsed.data.organizationId : null) ?? ctx.organizationId ?? parsed.data.organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: "no_organization" }, { status: 400 });
  }

  // Non-superadmin cannot invite outside their org
  if (ctx.role !== "superadmin" && ctx.organizationId && organizationId !== ctx.organizationId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const role = isAppRole(parsed.data.role) ? parsed.data.role : "client";
  try {
    const invite = await createInvite({
      organizationId,
      organizationName: parsed.data.organizationName ?? ctx.organizationName,
      email: parsed.data.email,
      role: role === "superadmin" ? "admin" : role,
      invitedBy: auth.userId,
    });
    try {
      await recordActivity({
        organizationId,
        userId: auth.userId,
        kind: "invite_created",
        title: `Invitación enviada: ${invite.email}`,
        meta: { inviteId: invite.id, role: invite.role, email: invite.email },
      });
      await logAudit({
        actorId: auth.userId,
        orgId: organizationId,
        action: "invite_create",
        meta: { inviteId: invite.id, role: invite.role, email: invite.email },
      });
    } catch {
      /* best-effort */
    }
    return NextResponse.json({
      invite,
      demo: !isSupabaseConfigured(),
      acceptPath: `/invitar?token=${invite.token}`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "invite_create_failed" },
      { status: 500 },
    );
  }
}
