import { NextResponse } from "next/server";
import { z } from "zod";
import { checkoutSessionParams, ensureMenoskaCustomer } from "@/lib/stripe-checkout";
import { getStripe, priceIdForPlan } from "@/lib/stripe";
import { PLAN_TYPES } from "@/lib/rbac";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/locales";
import { track } from "@/lib/analytics-server";

const schema = z.object({
  plan: z.enum(PLAN_TYPES),
  cycle: z.enum(["month", "year"]).default("month"),
  locale: z.string().optional(),
  orgId: z.string().optional(),
});

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Stripe no está configurado. Añade STRIPE_SECRET_KEY y los Price IDs." },
      { status: 501 },
    );
  }
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "invalid_plan" }, { status: 400 });

  const price = priceIdForPlan(parsed.data.plan, parsed.data.cycle);
  if (!price) {
    const env =
      parsed.data.cycle === "year"
        ? `STRIPE_PRICE_${parsed.data.plan.toUpperCase()}_YEARLY`
        : `STRIPE_PRICE_${parsed.data.plan.toUpperCase()}_MONTHLY`;
    return NextResponse.json({ error: `Falta ${env}` }, { status: 501 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!user?.email) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? request.headers.get("origin") ?? "http://localhost:3000";
  const locale = isLocale(parsed.data.locale) ? parsed.data.locale : DEFAULT_LOCALE;

  let orgId = parsed.data.orgId ?? "";
  let existingCustomerId: string | null = null;
  if (supabase && !orgId) {
    const { data: profile } = await supabase
      .from("mc_profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();
    orgId = profile?.organization_id ?? "";
  }
  const admin = createAdminSupabase();
  if (admin && orgId) {
    const { data: org } = await admin
      .from("mc_organizations")
      .select("stripe_customer_id")
      .eq("id", orgId)
      .maybeSingle();
    existingCustomerId = org?.stripe_customer_id ?? null;
  }

  void track("checkout_click", {
    plan: parsed.data.plan,
    cycle: parsed.data.cycle,
    organizationId: orgId || null,
    userId: user.id,
  });

  const stripe = getStripe();
  const customerId = await ensureMenoskaCustomer(stripe, {
    userId: user.id,
    email: user.email,
    existingCustomerId,
  });
  if (admin && orgId) {
    await admin.from("mc_organizations").update({ stripe_customer_id: customerId }).eq("id", orgId);
  }

  const session = await stripe.checkout.sessions.create(
    checkoutSessionParams({
      priceId: price,
      customerId,
      userId: user.id,
      mode: "subscription",
      successUrl: `${origin}/${locale}/dashboard/facturacion?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/${locale}/precios`,
      metadata: {
        user_id: user.id,
        price_id: price,
        project: "menoska",
        plan: parsed.data.plan,
        cycle: parsed.data.cycle,
        orgId,
      },
    }),
  );

  return NextResponse.json({ url: session.url });
}
