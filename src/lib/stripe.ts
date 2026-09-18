import Stripe from "stripe";
import type { PlanType } from "./rbac";

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!stripe) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}

export const PLAN_PRICE_ENV: Record<PlanType, string | undefined> = {
  starter: process.env.STRIPE_PRICE_STARTER,
  business: process.env.STRIPE_PRICE_BUSINESS,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
};

export function priceIdForPlan(plan: PlanType): string | undefined {
  return PLAN_PRICE_ENV[plan];
}
