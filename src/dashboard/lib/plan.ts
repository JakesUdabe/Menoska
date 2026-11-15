export type PlanType = "free" | "pro" | "business";

/** Máximo de créditos IA que puede acumular cualquier usuario. */
export const MAX_CREDITS_IA = 200;

export const PLAN_MONTHLY_CREDITS: Record<PlanType, number> = {
  free:     0,
  pro:      5,
  business: 30,
};

export const PLAN_ORDER: Record<PlanType, number> = {
  free:     0,
  pro:      1,
  business: 2,
};

const LEGACY_MAP: Record<string, PlanType> = {
  standard: "free",
  free:     "free",
  pro:      "pro",
  "pro+":   "business",
  business: "business",
};

export function normalizePlanType(planType: string | null | undefined): PlanType {
  if (!planType) return "free";
  return LEGACY_MAP[planType.trim().toLowerCase()] ?? "free";
}

export function isPaidPlan(planType: string | null | undefined): boolean {
  const plan = normalizePlanType(planType);
  return plan === "pro" || plan === "business";
}

export function isFreePlan(planType: string | null | undefined): boolean {
  return !isPaidPlan(planType);
}

export function comparePlans(a: PlanType, b: PlanType): number {
  return PLAN_ORDER[a] - PLAN_ORDER[b];
}
