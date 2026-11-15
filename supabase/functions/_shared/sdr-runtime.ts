/**
 * Runtime for AI SDR Edge Functions.
 * CRM gate matches sales-outreach: admin (and legacy admin_*) or empleado with crm.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { hasCrmAccess } from "./access.ts";
import { openaiAuthHeaders } from "./openai.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

export function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Product secrets: Deno.env / Supabase Edge Secrets only. */
export function envGet(name: string): string {
  return Deno.env.get(name)?.trim() || "";
}

export function createAdmin() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!supabaseUrl || !serviceKey) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  return { supabaseUrl, serviceKey, admin: createClient(supabaseUrl, serviceKey) };
}

/** Staff gate for enrich/launch/provision. Same rule as has_admin_module_access('crm'). */
export async function requireCrm(req: Request) {
  const { supabaseUrl, serviceKey, admin } = createAdmin();
  const bearer = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  if (!bearer) return { ok: false as const, response: json(401, { error: "No autorizado" }) };
  if (bearer === serviceKey) {
    return { ok: true as const, admin, supabaseUrl, userId: null as string | null };
  }
  const { data: { user }, error } = await admin.auth.getUser(bearer);
  if (error || !user) return { ok: false as const, response: json(401, { error: "Sesión inválida" }) };

  const { data: profile } = await admin
    .from("profiles")
    .select("role, employee_permissions")
    .eq("id", user.id)
    .maybeSingle();

  if (!hasCrmAccess(profile)) {
    return { ok: false as const, response: json(403, { error: "Sin acceso al CRM" }) };
  }
  return { ok: true as const, admin, supabaseUrl, userId: user.id };
}

export async function chatJson(
  system: string,
  user: string,
  options: { temperature?: number; maxTokens?: number } = {},
): Promise<Record<string, unknown>> {
  const apiKey = envGet("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  const model = envGet("SDR_AGENT_MODEL") || envGet("SALES_OUTREACH_MODEL") || envGet("CRM_OUTREACH_MODEL") || "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: openaiAuthHeaders(apiKey),
    body: JSON.stringify({
      model,
      temperature: options.temperature ?? 0.45,
      max_tokens: options.maxTokens ?? 1100,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI HTTP ${response.status}: ${text.slice(0, 280)}`);
  }
  const body = await response.json();
  const raw = String(body?.choices?.[0]?.message?.content ?? "{}");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("OpenAI response is not JSON.");
  return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
}
