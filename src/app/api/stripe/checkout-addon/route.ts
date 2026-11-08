import { NextResponse } from "next/server";
import { z } from "zod";
import { checkoutSessionParams, ensureMenoskaCustomer } from "@/lib/stripe-checkout";
import { getStripe, priceIdForAddon } from "@/lib/stripe";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/locales";
import { track } from "@/lib/analytics-server";

const schema = z.object({
  kind: z.enum(["seats", "sends"]),
  locale: z.string().optional(),
  orgId: z.string().optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  void track("checkout_click", { addon: parsed.data.kind, organizationId: parsed.data.orgId ?? null });

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "stripe_unconfigured", demo: true }, { status: 501 });
  }

  const price = priceIdForAddon(parsed.data.kind);
  if (!price) {
    return NextResponse.json(
      {
        error: "missing_price",
        env: parsed.data.kind === "seats" ? "STRIPE_PRICE_ADDON_SEATS" : "STRIPE_PRICE_ADDON_SENDS",
      },
      { status: 501 },
    );
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
  const orgId = parsed.data.orgId ?? "";
  const admin = createAdminSupabase();
  let existingCustomerId: string | null = null;
  if (admin && orgId) {
    const { data: org } = await admin
      .from("mc_organizations")
      .select("stripe_customer_id")
      .eq("id", orgId)
      .maybeSingle();
    existingCustomerId = org?.stripe_customer_id ?? null;
  }

  const stripe = getStripe();
  const customerId = await ensureMenoskaCustomer(stripe, {
    userId: user.id,
    email: user.email,
    existingCustomerId,
  });

  const session = await stripe.checkout.sessions.create(
    checkoutSessionParams({
      priceId: price,
      customerId,
      userId: user.id,
      mode: "subscription",
      successUrl: `${origin}/${locale}/dashboard/facturacion?addon=${parsed.data.kind}`,
      cancelUrl: `${origin}/${locale}/dashboard/facturacion`,
      metadata: {
        user_id: user.id,
        price_id: price,
        project: "menoska",
        kind: parsed.data.kind,
        orgId,
      },
    }),
  );

  return NextResponse.json({ url: session.url });
}
