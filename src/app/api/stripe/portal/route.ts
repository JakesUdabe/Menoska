import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe no está configurado." }, { status: 501 });
  }
  const supabase = await createServerSupabase();
  if (!supabase) return NextResponse.json({ error: "auth" }, { status: 401 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, organizations(stripe_customer_id)")
    .eq("id", user.id)
    .maybeSingle();

  const customerId = (profile as { organizations?: { stripe_customer_id?: string } | null } | null)?.organizations
    ?.stripe_customer_id;
  if (!customerId) return NextResponse.json({ error: "no_customer" }, { status: 400 });

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? request.headers.get("origin") ?? "http://localhost:3000";
  const stripe = getStripe();
  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/dashboard/facturacion`,
  });
  return NextResponse.json({ url: portal.url });
}
