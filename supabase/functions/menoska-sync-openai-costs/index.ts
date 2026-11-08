/**
 * Sincroniza costes diarios de OpenAI en mc_expenses.
 * Secret: OPENAI_ADMIN_API_KEY.
 * Optional: OPENAI_PROJECT_ID, OPENAI_ORG_ID, OPENAI_EUR_USD_RATE (default 0.92).
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function hasFinanceAccess(profile: {
  role?: string | null;
  employee_permissions?: Record<string, unknown> | null;
} | null): boolean {
  if (!profile?.role) return false;
  if (profile.role === "superadmin") return true;
  return profile.role === "empleado" && Boolean(profile.employee_permissions?.finanzas);
}

function openaiAuthHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  const projectId = Deno.env.get("OPENAI_PROJECT_ID")?.trim();
  const orgId = Deno.env.get("OPENAI_ORG_ID")?.trim();
  if (projectId) headers["OpenAI-Project"] = projectId;
  if (orgId) headers["OpenAI-Organization"] = orgId;
  return headers;
}

type CostAmount = { value?: number; currency?: string };
type CostResult = { amount?: CostAmount; line_item?: string | null };
type CostBucket = {
  start_time?: number;
  end_time?: number;
  results?: CostResult[];
  result?: CostResult[];
};
type CostsPage = {
  data?: CostBucket[];
  has_more?: boolean;
  next_page?: string | null;
};

function toDateKey(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

function bucketAmountUsd(bucket: CostBucket): number {
  const rows = bucket.results ?? bucket.result ?? [];
  return rows.reduce((sum, row) => sum + Number(row.amount?.value ?? 0), 0);
}

async function fetchAllCosts(adminKey: string, startTime: number, endTime: number): Promise<CostBucket[]> {
  const buckets: CostBucket[] = [];
  let page: string | null = null;

  for (let i = 0; i < 40; i++) {
    const url = new URL("https://api.openai.com/v1/organization/costs");
    url.searchParams.set("start_time", String(startTime));
    url.searchParams.set("end_time", String(endTime));
    url.searchParams.set("bucket_width", "1d");
    url.searchParams.set("limit", "180");
    if (page) url.searchParams.set("page", page);
    const projectId = Deno.env.get("OPENAI_PROJECT_ID")?.trim();
    if (projectId) url.searchParams.append("project_ids", projectId);

    const res = await fetch(url.toString(), { headers: openaiAuthHeaders(adminKey) });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenAI Costs API ${res.status}: ${body.slice(0, 300)}`);
    }

    const json = (await res.json()) as CostsPage;
    buckets.push(...(json.data ?? []));
    if (!json.has_more || !json.next_page) break;
    page = json.next_page;
  }

  return buckets;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    const adminKey = Deno.env.get("OPENAI_ADMIN_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const eurUsdRate = Number(Deno.env.get("OPENAI_EUR_USD_RATE") ?? "0.92");

    if (!adminKey) {
      return jsonResponse({
        ok: false,
        error: "Falta el secret OPENAI_ADMIN_API_KEY. Añádelo en Supabase → Edge Functions → Secrets.",
      });
    }
    if (!supabaseUrl || !supabaseAnonKey || !serviceRole) {
      return jsonResponse({ ok: false, error: "Función mal configurada (faltan SUPABASE_URL / ANON / SERVICE_ROLE)." });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ ok: false, error: "No autenticado." });

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ ok: false, error: authError?.message ?? "No autenticado." });
    }

    const { data: profile, error: profileError } = await userClient
      .from("mc_profiles")
      .select("role, employee_permissions")
      .eq("id", user.id)
      .single();

    if (profileError) return jsonResponse({ ok: false, error: `Perfil: ${profileError.message}` });
    if (!hasFinanceAccess(profile)) {
      return jsonResponse({
        ok: false,
        error: `Sin permisos (rol actual: ${profile?.role ?? "desconocido"}). Se requiere superadmin o empleado con finanzas.`,
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const buckets = await fetchAllCosts(adminKey, now - 90 * 24 * 60 * 60, now);
    const byDay = new Map<string, number>();
    for (const bucket of buckets) {
      if (typeof bucket.start_time !== "number") continue;
      const usd = bucketAmountUsd(bucket);
      if (usd <= 0) continue;
      const day = toDateKey(bucket.start_time);
      byDay.set(day, (byDay.get(day) ?? 0) + usd);
    }

    const adminClient = createClient(supabaseUrl, serviceRole);
    let upserted = 0;
    for (const [day, usd] of byDay) {
      const amountEur = Math.round(usd * eurUsdRate * 100) / 100;
      const externalId = `openai-cost-${day}`;
      const { error } = await adminClient.from("mc_expenses").upsert(
        {
          external_id: externalId,
          title: `OpenAI — ${day}`,
          amount: amountEur,
          category: "one_time",
          expense_date: day,
          billing_date: day,
          payment_date: null,
          provider: "openai",
          description: `Gasto OpenAI sincronizado (${usd.toFixed(4)} USD → ${amountEur.toFixed(2)} EUR)`,
          created_by: user.id,
        },
        { onConflict: "external_id" },
      );
      if (error) throw new Error(`Error guardando gasto ${externalId}: ${error.message}`);
      upserted += 1;
    }

    return jsonResponse({ ok: true, upserted, days: byDay.size });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error sincronizando OpenAI";
    console.error("[menoska-sync-openai-costs]", message);
    return jsonResponse({ ok: false, error: message });
  }
});
