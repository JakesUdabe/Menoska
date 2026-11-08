export const APP_ROLES = ["superadmin", "admin", "client"] as const;
export type AppRole = (typeof APP_ROLES)[number];

/** Session role. `empleado` is internal staff and is not an inviteable app role. */
export type SessionRole = AppRole | "empleado";

export function asSessionRole(value: string | null | undefined): SessionRole {
  if (value === "superadmin" || value === "admin" || value === "client" || value === "empleado") {
    return value;
  }
  return "client";
}

export const PLAN_TYPES = ["starter", "business", "enterprise"] as const;
export type PlanType = (typeof PLAN_TYPES)[number];

export function isAppRole(value: string | null | undefined): value is AppRole {
  return APP_ROLES.includes(value as AppRole);
}

export function isPlanType(value: string | null | undefined): value is PlanType {
  return PLAN_TYPES.includes(value as PlanType);
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
  if (plan === "business" || plan === "enterprise") return null;
  return 3;
}

/** Starter: 3 seats. Business: 10. Enterprise: unlimited. */
export function maxUsersPerOrg(plan: PlanType | null | undefined): number | null {
  if (plan === "enterprise") return null;
  if (plan === "business") return 10;
  return 3;
}

/** Monthly AI generation quota (reports + NL). Enterprise = unlimited. */
export function maxAiGenerationsPerMonth(plan: PlanType | null | undefined): number | null {
  if (plan === "enterprise") return null;
  if (plan === "business") return 200;
  return 20;
}

export function defaultAppRoute(_role?: SessionRole | null): string {
  return "/dashboard";
}
