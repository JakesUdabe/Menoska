import { NextResponse } from "next/server";
import { DEMO_PROFILES } from "@/lib/demo-data";
import { isPlanType, type PlanType } from "@/lib/rbac";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiAuth, type GuardFail, type GuardOk } from "./guard";

export type PlanGuardOk = GuardOk & {
  plan: PlanType;
  organizationId: string | null;
};

function parsePlan(value: string | null | undefined): PlanType | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return isPlanType(normalized) ? normalized : null;
}

/** Resolve caller plan after auth. Demo: x-demo-plan or DEMO_PROFILES; Supabase: mc_organizations.plan. */
export async function requireApiAuthWithPlan(
  request: Request,
  rateKeyPrefix = "api",
): Promise<PlanGuardOk | GuardFail> {
  const auth = await requireApiAuth(request, rateKeyPrefix);
  if (!auth.ok) return auth;

  if (auth.demo) {
    const headerPlan = parsePlan(request.headers.get("x-demo-plan"));
    const profile = DEMO_PROFILES.find((p) => p.id === auth.userId);
    const plan = headerPlan ?? profile?.plan ?? "starter";
    const headerOrg = request.headers.get("x-demo-org-id")?.trim();
    return {
      ...auth,
      plan,
      organizationId: auth.organizationId ?? profile?.organizationId ?? headerOrg ?? null,
    };
  }

  const supabase = await createServerSupabase();
  if (!supabase) {
    return { ok: false, response: NextResponse.json({ error: "auth" }, { status: 401 }) };
  }

  const { data, error } = await supabase
    .from("mc_profiles")
    .select("organization_id, mc_organizations!mc_profiles_organization_id_fkey(plan)")
    .eq("id", auth.userId)
    .maybeSingle();

  if (error || !data) {
    return {
      ok: true,
      userId: auth.userId,
      demo: false,
      plan: "starter",
      organizationId: null,
    };
  }

  const org = (
    data as {
      organization_id?: string | null;
      mc_organizations?: { plan?: string } | { plan?: string }[] | null;
    }
  ).mc_organizations;
  const orgObj = Array.isArray(org) ? org[0] : org;
  const plan = parsePlan(orgObj?.plan) ?? "starter";

  return {
    ok: true,
    userId: auth.userId,
    demo: false,
    plan,
    organizationId: (data as { organization_id?: string | null }).organization_id ?? null,
  };
}

export function planRequiredResponse() {
  return NextResponse.json({ error: "plan_required" }, { status: 403 });
}
