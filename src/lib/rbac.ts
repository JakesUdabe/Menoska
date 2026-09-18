export const APP_ROLES = ["superadmin", "admin", "client"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const PLAN_TYPES = ["starter", "business", "enterprise"] as const;
export type PlanType = (typeof PLAN_TYPES)[number];

export function isAppRole(value: string | null | undefined): value is AppRole {
  return APP_ROLES.includes(value as AppRole);
}

export function isSuperAdmin(role: string | null | undefined): boolean {
  return role === "superadmin";
}

export function isOrgAdmin(role: string | null | undefined): boolean {
  return role === "admin" || role === "superadmin";
}

export function canManageOrgUsers(role: string | null | undefined): boolean {
  return role === "admin" || role === "superadmin";
}

export function canUseNaturalLanguage(plan: PlanType | null | undefined): boolean {
  return plan === "business" || plan === "enterprise";
}

export function canUsePatents(plan: PlanType | null | undefined): boolean {
  return plan === "business" || plan === "enterprise";
}

export function maxActiveBulletins(plan: PlanType | null | undefined): number | null {
  if (plan === "starter" || !plan) return 3;
  return null;
}

export function maxUsersPerOrg(plan: PlanType | null | undefined): number | null {
  if (plan === "starter" || !plan) return 5;
  return null;
}

export function defaultAppRoute(_role?: AppRole | null): string {
  return "/dashboard";
}
