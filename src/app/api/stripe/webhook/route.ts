import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";

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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const customer = typeof session.customer === "string" ? session.customer : session.customer?.id;
    const subscription =
      typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
    const plan = session.metadata?.plan;
    console.info("stripe.checkout.completed", { customer, subscription, plan });
  }

  return NextResponse.json({ received: true });
}
