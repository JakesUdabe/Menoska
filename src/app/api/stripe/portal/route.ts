import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createServerSupabase } from "@/lib/supabase/server";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/locales";

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe no está configurado." }, { status: 501 });
  }

  let locale = DEFAULT_LOCALE;
  try {
    const body = (await request.json()) as { locale?: string };
    if (isLocale(body.locale)) locale = body.locale;
  } catch {
    /* empty body ok */
  }

  const supabase = await createServerSupabase();
  if (!supabase) return NextResponse.json({ error: "auth" }, { status: 401 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const { data: profile } = await supabase
    .from("mc_profiles")
    .select("organization_id, mc_organizations!organization_id(stripe_customer_id)")
    .eq("id", user.id)
    .maybeSingle();

  const orgRaw = (
    profile as { mc_organizations?: { stripe_customer_id?: string } | { stripe_customer_id?: string }[] | null } | null
  )?.mc_organizations;
  const org = Array.isArray(orgRaw) ? orgRaw[0] : orgRaw;
  const customerId = org?.stripe_customer_id;
  if (!customerId) return NextResponse.json({ error: "no_customer" }, { status: 400 });

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? request.headers.get("origin") ?? "http://localhost:3000";
  const stripe = getStripe();
  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/${locale}/dashboard/facturacion`,
  });
  return NextResponse.json({ url: portal.url });
}
