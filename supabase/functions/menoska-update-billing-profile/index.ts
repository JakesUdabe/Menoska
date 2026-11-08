import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) throw new Error("Supabase no configurado.");
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No autenticado.");
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error } = await userClient.auth.getUser();
    if (error || !user) throw new Error("No autenticado.");

    const body = await req.json();
    const admin = createClient(supabaseUrl, serviceKey);
    const row = {
      user_id: user.id,
      legal_name: body.legalName ?? null,
      tax_id: body.taxId ?? null,
      tax_id_type: body.taxIdType ?? null,
      billing_email: body.billingEmail ?? user.email,
      address_line1: body.addressLine1 ?? null,
      address_line2: body.addressLine2 ?? null,
      postal_code: body.postalCode ?? null,
      city: body.city ?? null,
      province: body.province ?? null,
      country: body.country ?? "ES",
      fiscal_status: body.legalName && body.taxId && body.addressLine1 ? "complete" : "incomplete",
      updated_at: new Date().toISOString(),
    };
    const { error: upsertError } = await admin.from("billing_profiles").upsert(row, { onConflict: "user_id" });
    if (upsertError) throw new Error(upsertError.message);
    return Response.json({ ok: true }, { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "error";
    return Response.json({ ok: false, error: message }, { headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
