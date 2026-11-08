import { isSupabaseConfigured, createClient } from "@/lib/supabase/client";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import type { AppRole, PlanType } from "@/lib/rbac";
import {
  acceptDemoInvite,
  findDemoInviteByToken,
  listDemoPendingForOrg,
  randomInviteToken,
  upsertDemoInvite,
  type OrgInvite,
} from "@/lib/invites-store";

export type { OrgInvite };

type InviteRow = {
  id: string;
  organization_id: string;
  email: string;
  role: AppRole;
  invited_by: string | null;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  mc_organizations?: { name?: string } | { name?: string }[] | null;
};

function mapRow(row: InviteRow): OrgInvite {
  const org = Array.isArray(row.mc_organizations) ? row.mc_organizations[0] : row.mc_organizations;
  return {
    id: row.id,
    organizationId: row.organization_id,
    organizationName: org?.name,
    email: row.email,
    role: row.role,
    invitedBy: row.invited_by,
    token: row.token,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    createdAt: row.created_at,
  };
}

export async function listPendingInvitesForOrg(organizationId: string): Promise<OrgInvite[]> {
  if (!isSupabaseConfigured()) {
    return listDemoPendingForOrg(organizationId);
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("mc_organization_invites")
    .select("*, mc_organizations(name)")
    .eq("organization_id", organizationId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("mc_organization_invites list failed", error.message);
    return listDemoPendingForOrg(organizationId);
  }
  return (data as InviteRow[] | null)?.map(mapRow) ?? [];
}

export async function createInvite(input: {
  organizationId: string;
  organizationName?: string;
  email: string;
  role: AppRole;
  invitedBy: string;
}): Promise<OrgInvite> {
  const email = input.email.trim().toLowerCase();
  const role: AppRole = input.role === "superadmin" ? "admin" : input.role;

  if (!isSupabaseConfigured()) {
    return upsertDemoInvite({
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `inv-${Date.now()}`,
      organizationId: input.organizationId,
      organizationName: input.organizationName,
      email,
      role,
      invitedBy: input.invitedBy,
      token: randomInviteToken(),
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      acceptedAt: null,
      createdAt: new Date().toISOString(),
    });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("mc_organization_invites")
    .insert({
      organization_id: input.organizationId,
      email,
      role,
      invited_by: input.invitedBy,
    })
    .select("*, mc_organizations(name)")
    .maybeSingle();
  if (error || !data) {
    throw new Error(error?.message ?? "invite_create_failed");
  }
  return mapRow(data as InviteRow);
}

type LookupInviteRow = {
  id: string;
  organization_id: string;
  organization_name: string | null;
  email: string;
  role: AppRole;
  expires_at: string;
};

export async function getInviteByToken(token: string): Promise<OrgInvite | null> {
  const trimmed = token.trim();
  if (!trimmed) return null;

  if (!isSupabaseConfigured()) {
    const found = findDemoInviteByToken(trimmed);
    if (!found || found.acceptedAt) return null;
    if (new Date(found.expiresAt) <= new Date()) return null;
    return found;
  }

  // Token preview must use mc_lookup_invite — never select pending invites from the table as anon.
  const supabase = (await createServerSupabase()) ?? createClient();
  const { data, error } = await supabase.rpc("mc_lookup_invite", { p_token: trimmed });
  const row = (Array.isArray(data) ? data[0] : data) as LookupInviteRow | null;
  if (error || !row) {
    const demo = findDemoInviteByToken(trimmed);
    return demo && !demo.acceptedAt && new Date(demo.expiresAt) > new Date() ? demo : null;
  }
  return {
    id: row.id,
    organizationId: row.organization_id,
    organizationName: row.organization_name ?? undefined,
    email: row.email,
    role: row.role,
    invitedBy: null,
    token: trimmed,
    expiresAt: row.expires_at,
    acceptedAt: null,
    createdAt: "",
  };
}

export type AcceptInviteResult = {
  invite: OrgInvite;
  demoAccount?: {
    email: string;
    password: string;
    profile: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      fullName: string;
      role: AppRole;
      locale: string;
      organizationId: string;
      organizationName: string;
      organizationDomain: string;
      plan: PlanType;
    };
  };
};

export async function acceptInvite(input: {
  token: string;
  userId?: string;
  firstName?: string;
  lastName?: string;
  password?: string;
}): Promise<AcceptInviteResult> {
  if (!isSupabaseConfigured()) {
    return acceptDemoInvite(input);
  }

  const invite = await getInviteByToken(input.token);
  if (!invite) throw new Error("invite_invalid");

  // Accepting users are not org admins yet — prefer service role for profile + invite writes.
  const admin = createAdminSupabase();
  const userClient = await createServerSupabase();
  const writer = admin ?? userClient;
  if (!writer) throw new Error("auth");

  if (input.userId) {
    const { error: profileErr } = await writer
      .from("mc_profiles")
      .update({
        organization_id: invite.organizationId,
        role: invite.role === "superadmin" ? "admin" : invite.role,
        ...(input.firstName ? { first_name: input.firstName } : {}),
        ...(input.lastName ? { last_name: input.lastName } : {}),
      })
      .eq("id", input.userId);
    if (profileErr) throw new Error(profileErr.message);
  }

  const { data, error } = await writer
    .from("mc_organization_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("token", input.token.trim())
    .is("accepted_at", null)
    .select("*, mc_organizations(name)")
    .maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "invite_accept_failed");
  return { invite: mapRow(data as InviteRow) };
}
