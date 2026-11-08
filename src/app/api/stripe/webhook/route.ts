import { NextResponse } from "next/server";
import { getStripe, isMenoskaPrice, isMenoskaProject, planFromPriceMetadata } from "@/lib/stripe";
import { planForPriceId } from "@/lib/billing/catalog";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isPlanType } from "@/lib/rbac";
import type Stripe from "stripe";

function priceIdFromSubscription(sub: Stripe.Subscription): string | null {
  return sub.items.data[0]?.price?.id ?? null;
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "webhook_unconfigured" }, { status: 501 });
  }
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "signature" }, { status: 400 });

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  console.info("stripe.webhook", { type: event.type, id: event.id });

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    if (!isMenoskaProject(session.metadata) || !isMenoskaPrice(session.metadata?.price_id)) {
      return NextResponse.json({ received: true, ignored: "foreign_price" });
    }
    const customer = typeof session.customer === "string" ? session.customer : session.customer?.id;
    const subscription =
      typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
    const plan = planFromPriceMetadata(session.metadata) ?? planForPriceId(session.metadata?.price_id);
    const orgId = session.metadata?.orgId ?? session.metadata?.organization_id;
    const admin = createAdminSupabase();
    if (admin && orgId && plan && !session.metadata?.kind) {
      const { error } = await admin
        .from("mc_organizations")
        .update({
          plan,
          stripe_customer_id: customer ?? undefined,
          stripe_subscription_id: subscription ?? undefined,
        })
        .eq("id", orgId);
      if (error) console.warn("mc_organizations update skipped", error.message);
    }
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const priceId = priceIdFromSubscription(sub);
    if (!isMenoskaProject(sub.metadata) || !isMenoskaPrice(priceId)) {
      return NextResponse.json({ received: true, ignored: "foreign_price" });
    }
    const orgId = sub.metadata?.orgId ?? sub.metadata?.organization_id;
    const plan = planFromPriceMetadata(sub.metadata) ?? planForPriceId(priceId);
    const admin = createAdminSupabase();
    if (admin && orgId && !sub.metadata?.kind) {
      const patch: Record<string, string | null> = {
        stripe_subscription_id: event.type === "customer.subscription.deleted" ? null : sub.id,
      };
      if (event.type === "customer.subscription.deleted") patch.plan = "starter";
      else if (plan && isPlanType(plan)) patch.plan = plan;
      const { error } = await admin.from("mc_organizations").update(patch).eq("id", orgId);
      if (error) console.warn("mc_organizations subscription update skipped", error.message);
    }
  }

  return NextResponse.json({ received: true });
}
