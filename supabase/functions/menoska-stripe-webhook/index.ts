import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ProductBrand = "proposalyze" | "menoska" | "astoha";
const BRANDS = new Set<ProductBrand>(["proposalyze", "menoska", "astoha"]);

function resolveProductBrand(candidates: Array<string | null | undefined>): ProductBrand | null {
  for (const raw of candidates) {
    const key = (raw ?? "").trim().toLowerCase();
    if (BRANDS.has(key as ProductBrand)) return key as ProductBrand;
  }
  return null;
}

const PROJECT = "menoska";

const PRICE_PLAN: Record<string, "starter" | "business" | "enterprise"> = {
  price_1UZZ89F3yyKUpy6txpLvpy9g: "starter",
  price_1UZZ8AF3yyKUpy6tsnxDbrVT: "starter",
  price_1UZZ8BF3yyKUpy6t33qnYHX1: "business",
  price_1UZZ8DF3yyKUpy6tuDLcOznL: "business",
  price_1UZZ8EF3yyKUpy6t3TdUtVg4: "enterprise",
  price_1UZZ8GF3yyKUpy6t1KTE1avw: "enterprise",
};

const KNOWN = new Set<string>([
  ...Object.keys(PRICE_PLAN),
  "price_1UZZ8HF3yyKUpy6tfs6USk11",
  "price_1UZZ8NF3yyKUpy6t7NjbUtOJ",
  "price_1UWIJHF3yyKUpy6tMLQyWgMw",
]);

function known(priceId: string | null | undefined): boolean {
  return Boolean(priceId && KNOWN.has(priceId));
}

serve(async (req: Request) => {
  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET_MENOSKA");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!stripeSecret || !webhookSecret || !supabaseUrl || !serviceKey) {
    return new Response("Server misconfigured", { status: 500 });
  }

  const stripe = new Stripe(stripeSecret, {
    apiVersion: "2024-04-10",
    httpClient: Stripe.createFetchHttpClient(),
  });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing stripe-signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(await req.text(), signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid signature";
    return new Response(message, { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: seen } = await admin.from("mc_stripe_events").select("id").eq("id", event.id).maybeSingle();
  if (seen) return Response.json({ received: true, duplicate: true });

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const priceId = session.metadata?.price_id ?? null;
      if (session.metadata?.project !== PROJECT || !known(priceId)) {
        await admin.from("mc_stripe_events").insert({ id: event.id });
        return Response.json({ received: true, ignored: "foreign_price" });
      }
      const plan = priceId ? PRICE_PLAN[priceId] : undefined;
      const orgId = session.metadata?.orgId ?? session.metadata?.organization_id;
      const customer = typeof session.customer === "string" ? session.customer : session.customer?.id;
      const subscription = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      if (orgId && plan && !session.metadata?.kind) {
        await admin.from("mc_organizations").update({
          plan,
          stripe_customer_id: customer ?? null,
          stripe_subscription_id: subscription ?? null,
        }).eq("id", orgId);
      }
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const priceId = sub.items.data[0]?.price?.id ?? null;
      if (sub.metadata?.project !== PROJECT || !known(priceId)) {
        await admin.from("mc_stripe_events").insert({ id: event.id });
        return Response.json({ received: true, ignored: "foreign_price" });
      }
      const orgId = sub.metadata?.orgId ?? sub.metadata?.organization_id;
      const plan = priceId ? PRICE_PLAN[priceId] : undefined;
      if (orgId && !sub.metadata?.kind) {
        await admin.from("mc_organizations").update({
          plan: event.type === "customer.subscription.deleted" ? "starter" : plan,
          stripe_subscription_id: event.type === "customer.subscription.deleted" ? null : sub.id,
        }).eq("id", orgId);
      }
    }

    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      const linePrice = invoice.lines?.data
        ?.map((line) => (typeof line.price === "string" ? line.price : line.price?.id))
        .find((id) => known(id ?? null));
      const priceId = invoice.metadata?.price_id ?? linePrice ?? null;
      let customer: Stripe.Customer | null = null;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null;
      if (customerId) {
        const retrieved = await stripe.customers.retrieve(customerId);
        if (!("deleted" in retrieved && retrieved.deleted)) customer = retrieved as Stripe.Customer;
      }
      const brand = resolveProductBrand([
        invoice.metadata?.project,
        customer?.metadata?.project,
        invoice.lines?.data?.[0]?.price && typeof invoice.lines.data[0].price === "object"
          ? invoice.lines.data[0].price.metadata?.project
          : null,
      ]);
      if (brand !== PROJECT || !known(priceId)) {
        await admin.from("mc_stripe_events").insert({ id: event.id });
        return Response.json({ received: true, ignored: "foreign_price" });
      }
      const userId = invoice.metadata?.user_id ?? customer?.metadata?.user_id ?? null;
      const amountTotal = invoice.amount_paid ?? invoice.total ?? 0;
      const amountTax = invoice.tax ?? 0;
      const { error } = await admin.from("legal_invoices").insert({
        stripe_invoice_id: invoice.id,
        stripe_payment_intent_id: typeof invoice.payment_intent === "string" ? invoice.payment_intent : invoice.payment_intent?.id ?? null,
        stripe_customer_id: customerId,
        user_id: userId,
        currency: invoice.currency ?? "eur",
        amount_subtotal: Math.max(0, amountTotal - amountTax),
        amount_tax: amountTax,
        amount_total: amountTotal,
        tax_regime: "es_iva_21",
        buyer_legal_name: customer?.name ?? invoice.customer_name,
        buyer_email: customer?.email ?? invoice.customer_email,
        buyer_country: customer?.address?.country ?? invoice.customer_address?.country ?? "ES",
        buyer_address_line1: customer?.address?.line1 ?? invoice.customer_address?.line1,
        buyer_postal_code: customer?.address?.postal_code ?? invoice.customer_address?.postal_code,
        buyer_city: customer?.address?.city ?? invoice.customer_address?.city,
        description: "Servicios Menoska",
        product_brand: PROJECT,
        status: customer?.name ? "queued" : "pending_fiscal_data",
      });
      if (!error) {
        const { data: row } = await admin.from("legal_invoices").select("id, status").eq("stripe_invoice_id", invoice.id).maybeSingle();
        if (row?.status === "queued") {
          await admin.from("fakturabai_jobs").insert({ legal_invoice_id: row.id, job_kind: "issue", status: "pending" });
        }
      }
    }

    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const amount = charge.amount ?? 0;
      const refunded = charge.amount_refunded ?? 0;
      const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id ?? null;
      const { data: invoice } = paymentIntentId
        ? await admin.from("legal_invoices").select("id, product_brand").eq("stripe_payment_intent_id", paymentIntentId).maybeSingle()
        : { data: null };
      if (invoice?.product_brand !== PROJECT) {
        await admin.from("mc_stripe_events").insert({ id: event.id });
        return Response.json({ received: true, ignored: "foreign_price" });
      }
      if (amount <= 0 || refunded < amount) {
        console.info("menoska.partial_refund", { charge: charge.id, amount, refunded, legalInvoiceId: invoice.id });
      } else {
        await admin.rpc("enqueue_legal_invoice_cancel", {
          p_legal_invoice_id: invoice.id,
          p_stripe_refund_id: charge.refunds?.data?.[0]?.id ?? null,
        });
      }
    }

    await admin.from("mc_stripe_events").insert({ id: event.id });
    return Response.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "error";
    console.error("[menoska-stripe-webhook]", message);
    return Response.json({ error: message }, { status: 500 });
  }
});
