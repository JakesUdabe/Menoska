import { NextResponse } from "next/server";
import { z } from "zod";
import { getStripe, priceIdForPlan } from "@/lib/stripe";
import { PLAN_TYPES } from "@/lib/rbac";
import { createServerSupabase } from "@/lib/supabase/server";

const schema = z.object({
  plan: z.enum(PLAN_TYPES),
});

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe no está configurado. Añade STRIPE_SECRET_KEY y los Price IDs." }, { status: 501 });
  }
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "invalid_plan" }, { status: 400 });

  const price = priceIdForPlan(parsed.data.plan);
  if (!price) {
    return NextResponse.json({ error: `Falta STRIPE_PRICE_${parsed.data.plan.toUpperCase()}` }, { status: 501 });
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? request.headers.get("origin") ?? "http://localhost:3000";
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    success_url: `${origin}/dashboard/facturacion?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/precios`,
    customer_email: user?.email,
    metadata: { plan: parsed.data.plan, user_id: user?.id ?? "" },
    subscription_data: { metadata: { plan: parsed.data.plan } },
  });

  return NextResponse.json({ url: session.url });
}
