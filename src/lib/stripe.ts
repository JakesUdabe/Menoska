import Stripe from "stripe";
import { CATALOG_ADDONS, CATALOG_PLANS, FAKTURABAI_TEST, isCatalogPriceId, PROJECT_SLUG, STRIPE_PRICE_IDS, type BillingCycle } from "@/lib/billing/catalog";
import { isPlanType, type PlanType } from "@/lib/rbac";

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

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

/** Monthly price, with the legacy un-cycled env as fallback. */
const LEGACY_MONTHLY: Record<PlanType, string> = {
  starter: "STRIPE_PRICE_STARTER",
  business: "STRIPE_PRICE_BUSINESS",
  enterprise: "STRIPE_PRICE_ENTERPRISE",
};

const FALLBACK_PLAN_PRICE: Record<PlanType, Record<BillingCycle, string>> = {
  starter: { month: STRIPE_PRICE_IDS.starterMonthly, year: STRIPE_PRICE_IDS.starterYearly },
  business: { month: STRIPE_PRICE_IDS.businessMonthly, year: STRIPE_PRICE_IDS.businessYearly },
  enterprise: { month: STRIPE_PRICE_IDS.enterpriseMonthly, year: STRIPE_PRICE_IDS.enterpriseYearly },
};

export function priceIdForPlan(plan: PlanType, cycle: BillingCycle = "month"): string | undefined {
  const row = CATALOG_PLANS.find((item) => item.plan === plan);
  if (!row) return undefined;
  if (cycle === "year") return readEnv(row.envYearly) ?? FALLBACK_PLAN_PRICE[plan].year;
  return readEnv(row.envMonthly) ?? readEnv(LEGACY_MONTHLY[plan]) ?? FALLBACK_PLAN_PRICE[plan].month;
}

export function priceIdForAddon(kind: "seats" | "sends"): string | undefined {
  return readEnv(CATALOG_ADDONS[kind].env) ?? (kind === "seats" ? STRIPE_PRICE_IDS.addonSeats : STRIPE_PRICE_IDS.addonSends);
}

export function fakturabaiTestPriceId(): string | undefined {
  return readEnv(FAKTURABAI_TEST.env);
}

/** Price ids that belong to this product. Foreign Proposalyze / Astoha prices are absent. */
export function menoskaPriceIds(): Set<string> {
  const ids = new Set<string>();
  for (const row of CATALOG_PLANS) {
    const monthly = readEnv(row.envMonthly) ?? readEnv(LEGACY_MONTHLY[row.plan]);
    const yearly = readEnv(row.envYearly);
    if (monthly) ids.add(monthly);
    if (yearly) ids.add(yearly);
  }
  for (const addon of Object.values(CATALOG_ADDONS)) {
    const id = readEnv(addon.env);
    if (id) ids.add(id);
  }
  const test = fakturabaiTestPriceId();
  if (test) ids.add(test);
  return ids;
}

export function isMenoskaPrice(priceId: string | null | undefined): boolean {
  if (!priceId) return false;
  return isCatalogPriceId(priceId) || menoskaPriceIds().has(priceId);
}

export function planFromPriceMetadata(metadata: Stripe.Metadata | null | undefined): PlanType | null {
  const plan = metadata?.plan;
  return isPlanType(plan) ? plan : null;
}

export function isMenoskaProject(metadata: Stripe.Metadata | null | undefined): boolean {
  return metadata?.project === PROJECT_SLUG;
}
