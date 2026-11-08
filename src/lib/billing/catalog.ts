import type { PlanType } from "@/lib/rbac";

/** Commercial brand slug. Same value as Stripe metadata.project and FakturaBAI. */
export const PROJECT_SLUG = "menoska";

/** TicketBAI series for this product. Not PZ (Proposalyze). */
export const INVOICE_SERIE = "MK";

export type BillingCycle = "month" | "year";

export type CatalogPlan = {
  plan: PlanType;
  /** EUR cents, tax excluded. */
  monthlyCents: number;
  yearlyCents: number;
  lookupMonthly: string;
  lookupYearly: string;
  envMonthly: string;
  envYearly: string;
  /** null = unlimited inside the organization. */
  users: number | null;
  bulletins: number | null;
  aiPerMonth: number | null;
};

/**
 * Public offer for an innovation lead in a Spanish industrial SME
 * or a small consultancy. Amounts are ex-VAT. Yearly is 10 months
 * (two months included) so a director can approve it without a tender.
 */
export const CATALOG_PLANS: readonly CatalogPlan[] = [
  {
    plan: "starter",
    monthlyCents: 14_900,
    yearlyCents: 149_000,
    lookupMonthly: "menoska-starter-monthly",
    lookupYearly: "menoska-starter-yearly",
    envMonthly: "STRIPE_PRICE_STARTER_MONTHLY",
    envYearly: "STRIPE_PRICE_STARTER_YEARLY",
    users: 3,
    bulletins: 3,
    aiPerMonth: 20,
  },
  {
    plan: "business",
    monthlyCents: 34_900,
    yearlyCents: 349_000,
    lookupMonthly: "menoska-business-monthly",
    lookupYearly: "menoska-business-yearly",
    envMonthly: "STRIPE_PRICE_BUSINESS_MONTHLY",
    envYearly: "STRIPE_PRICE_BUSINESS_YEARLY",
    users: 10,
    bulletins: null,
    aiPerMonth: 200,
  },
  {
    plan: "enterprise",
    monthlyCents: 89_000,
    yearlyCents: 890_000,
    lookupMonthly: "menoska-enterprise-monthly",
    lookupYearly: "menoska-enterprise-yearly",
    envMonthly: "STRIPE_PRICE_ENTERPRISE_MONTHLY",
    envYearly: "STRIPE_PRICE_ENTERPRISE_YEARLY",
    users: null,
    bulletins: null,
    aiPerMonth: null,
  },
] as const;

export const CATALOG_ADDONS = {
  seats: {
    cents: 4_900,
    extraSeats: 3,
    lookup: "menoska-addon-seats-monthly",
    env: "STRIPE_PRICE_ADDON_SEATS",
  },
  sends: {
    cents: 2_900,
    extraSends: 20,
    lookup: "menoska-addon-sends-monthly",
    env: "STRIPE_PRICE_ADDON_SENDS",
  },
} as const;

/** Internal FakturaBAI probe. Never render this on the website. */
export const FAKTURABAI_TEST = {
  cents: 50,
  lookup: "menoska-fakturabai-test-050",
  env: "STRIPE_PRICE_FAKTURABAI_TEST",
  priceId: "price_1UWIJHF3yyKUpy6tMLQyWgMw",
} as const;

/** Live price ids on acct_1TBIFCF3yyKUpy6t. Not secret keys. */
export const STRIPE_PRICE_IDS = {
  starterMonthly: "price_1UZZ89F3yyKUpy6txpLvpy9g",
  starterYearly: "price_1UZZ8AF3yyKUpy6tsnxDbrVT",
  businessMonthly: "price_1UZZ8BF3yyKUpy6t33qnYHX1",
  businessYearly: "price_1UZZ8DF3yyKUpy6tuDLcOznL",
  enterpriseMonthly: "price_1UZZ8EF3yyKUpy6t3TdUtVg4",
  enterpriseYearly: "price_1UZZ8GF3yyKUpy6t1KTE1avw",
  addonSeats: "price_1UZZ8HF3yyKUpy6tfs6USk11",
  addonSends: "price_1UZZ8NF3yyKUpy6t7NjbUtOJ",
  fakturabaiTest: FAKTURABAI_TEST.priceId,
} as const;

const PRICE_PLAN: Record<string, PlanType> = {
  [STRIPE_PRICE_IDS.starterMonthly]: "starter",
  [STRIPE_PRICE_IDS.starterYearly]: "starter",
  [STRIPE_PRICE_IDS.businessMonthly]: "business",
  [STRIPE_PRICE_IDS.businessYearly]: "business",
  [STRIPE_PRICE_IDS.enterpriseMonthly]: "enterprise",
  [STRIPE_PRICE_IDS.enterpriseYearly]: "enterprise",
};

export function planForPriceId(priceId: string | null | undefined): PlanType | null {
  if (!priceId) return null;
  return PRICE_PLAN[priceId] ?? null;
}

export function isCatalogPriceId(priceId: string | null | undefined): boolean {
  if (!priceId) return false;
  return (Object.values(STRIPE_PRICE_IDS) as string[]).includes(priceId);
}

export function catalogPlan(plan: PlanType): CatalogPlan {
  const found = CATALOG_PLANS.find((row) => row.plan === plan);
  if (!found) throw new Error(`Unknown plan ${plan}`);
  return found;
}

export function centsFor(plan: PlanType, cycle: BillingCycle): number {
  const row = catalogPlan(plan);
  return cycle === "year" ? row.yearlyCents : row.monthlyCents;
}

export function formatEuros(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
