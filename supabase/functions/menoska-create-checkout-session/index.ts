import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROJECT = "menoska";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!stripeSecret || !supabaseUrl || !anonKey || !serviceKey) throw new Error("Supabase o Stripe no configurado.");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No autenticado.");
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error } = await userClient.auth.getUser();
    if (error || !user?.email) throw new Error("No autenticado.");

    const body = await req.json();
    const priceId = String(body.priceId ?? "");
    const successUrl = String(body.successUrl ?? "");
    const cancelUrl = String(body.cancelUrl ?? "");
    if (!priceId || !successUrl || !cancelUrl) throw new Error("priceId, successUrl y cancelUrl son obligatorios.");

    const stripe = new Stripe(stripeSecret, { apiVersion: "2024-04-10", httpClient: Stripe.createFetchHttpClient() });
    const price = await stripe.prices.retrieve(priceId);
    if (price.metadata?.project !== PROJECT) throw new Error("El precio no es de Menoska.");

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await admin.from("mc_profiles").select("organization_id").eq("id", user.id).maybeSingle();
    let customerId: string | null = null;
    if (profile?.organization_id) {
      const { data: org } = await admin.from("mc_organizations").select("stripe_customer_id").eq("id", profile.organization_id).maybeSingle();
      customerId = org?.stripe_customer_id ?? null;
    }
    if (customerId) {
      const current = await stripe.customers.retrieve(customerId);
      if ("deleted" in current && current.deleted) customerId = null;
      else if (current.metadata?.project && current.metadata.project !== PROJECT) customerId = null;
    }
    const metadata = { user_id: user.id, project: PROJECT };
    if (!customerId) {
      const created = await stripe.customers.create({ email: user.email, metadata });
      customerId = created.id;
    } else {
      await stripe.customers.update(customerId, { email: user.email, metadata });
    }
    if (profile?.organization_id) {
      await admin.from("mc_organizations").update({ stripe_customer_id: customerId }).eq("id", profile.organization_id);
    }

    const sessionMetadata = { user_id: user.id, price_id: priceId, project: PROJECT, plan: price.metadata?.plan ?? "", orgId: profile?.organization_id ?? "" };
    const mode = price.type === "recurring" ? "subscription" : "payment";
    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      customer: customerId,
      customer_update: { name: "auto", address: "auto" },
      metadata: sessionMetadata,
      tax_id_collection: { enabled: true, required: "if_supported" },
      billing_address_collection: "required",
      custom_fields: [{
        key: "razon_social",
        label: { type: "custom", custom: "Razón social / Nombre fiscal" },
        type: "text",
        optional: false,
      }],
      allow_promotion_codes: true,
      success_url: successUrl,
      cancel_url: cancelUrl,
      ...(mode === "subscription"
        ? { subscription_data: { metadata: sessionMetadata } }
        : { invoice_creation: { enabled: true, invoice_data: { metadata: sessionMetadata } } }),
    });
    return Response.json({ ok: true, url: session.url }, { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "error";
    return Response.json({ ok: false, error: message }, { headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
