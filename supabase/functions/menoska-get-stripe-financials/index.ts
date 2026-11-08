/**
 * Ingresos mensuales de Stripe para el admin interno de Menoska.
 * Secret: STRIPE_SECRET_KEY.
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function hasFinanceAccess(profile: {
  role?: string | null;
  employee_permissions?: Record<string, unknown> | null;
} | null): boolean {
  if (!profile?.role) return false;
  if (profile.role === "superadmin") return true;
  return profile.role === "empleado" && Boolean(profile.employee_permissions?.finanzas);
}

function monthStart(year: number, month: number): number {
  return Math.floor(new Date(Date.UTC(year, month, 1)).getTime() / 1000);
}

async function monthRevenue(stripe: Stripe, year: number, month: number): Promise<number> {
  const start = monthStart(year, month);
  const end = monthStart(year, month + 1);
  let revenue = 0;
  let startingAfter: string | undefined;

  for (;;) {
    const page = await stripe.charges.list({
      created: { gte: start, lt: end },
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    for (const charge of page.data) {
      if (charge.paid && !charge.refunded) revenue += charge.amount;
    }
    if (!page.has_more || page.data.length === 0) break;
    startingAfter = page.data[page.data.length - 1]?.id;
  }

  return revenue / 100;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

    if (!stripeSecretKey || !supabaseUrl || !supabaseAnonKey) {
      return new Response(JSON.stringify({ ok: false, error: "Función mal configurada." }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, error: "No autenticado." }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ ok: false, error: "No autenticado." }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await userClient
      .from("mc_profiles")
      .select("role, employee_permissions")
      .eq("id", user.id)
      .single();

    if (!hasFinanceAccess(profile)) {
      return new Response(JSON.stringify({ ok: false, error: "Sin permisos." }), {
        status: 403,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    let requestedYear: number | undefined;
    try {
      const body = (await req.json()) as { year?: unknown };
      if (typeof body.year === "number" && Number.isFinite(body.year)) {
        requestedYear = Math.trunc(body.year);
      }
    } catch {
      // empty body is fine
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });
    const now = new Date();
    const monthlyBreakdown: { month: string; revenue: number }[] = [];

    if (requestedYear !== undefined) {
      for (let m = 0; m < 12; m++) {
        const revenue = await monthRevenue(stripe, requestedYear, m);
        monthlyBreakdown.push({
          month: `${requestedYear}-${String(m + 1).padStart(2, "0")}`,
          revenue,
        });
      }
    } else {
      for (let i = 5; i >= 0; i--) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
        const y = d.getUTCFullYear();
        const m = d.getUTCMonth();
        const revenue = await monthRevenue(stripe, y, m);
        monthlyBreakdown.push({
          month: `${y}-${String(m + 1).padStart(2, "0")}`,
          revenue,
        });
      }
    }

    const currentKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const prevDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const previousKey = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, "0")}`;
    const current =
      monthlyBreakdown.find((x) => x.month === currentKey)?.revenue ??
      monthlyBreakdown[monthlyBreakdown.length - 1]?.revenue ??
      0;
    const previous = monthlyBreakdown.find((x) => x.month === previousKey)?.revenue ?? 0;
    const avgLast3 =
      monthlyBreakdown.slice(-3).reduce((s, x) => s + x.revenue, 0) / Math.min(3, monthlyBreakdown.length || 1);
    const forecast = Math.max(current, avgLast3 * 1.05);
    const yearRevenue = monthlyBreakdown.reduce((s, x) => s + x.revenue, 0);

    return new Response(
      JSON.stringify({
        ok: true,
        currentMonthRevenue: current,
        previousMonthRevenue: previous,
        forecastRevenue: Math.round(forecast * 100) / 100,
        yearRevenue: Math.round(yearRevenue * 100) / 100,
        year: requestedYear ?? now.getUTCFullYear(),
        monthlyBreakdown,
      }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
