/**
 * POST /functions/v1/sdr-leads-infer-locale
 * Rellena country + language faltantes en sdr_leads vía OpenAI (y heurísticas).
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsHeaders,
  enrichLeadLocalesWithLlm,
  json,
  requireCrm,
  resolveLeadLanguage,
} from "../_shared/sdr.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {    const auth = await requireCrm(req);
    if (!auth.ok) return auth.response;
    const admin = auth.admin;

    const body = await req.json().catch(() => ({}));
    const campaignId = String(body.campaign_id ?? "").trim();
    if (!campaignId) return json(400, { error: "campaign_id es obligatorio." });

    const onlyMissing = body.only_missing !== false;
    const leadIds = Array.isArray(body.lead_ids)
      ? body.lead_ids.map((id: unknown) => String(id).trim()).filter(Boolean).slice(0, 80)
      : [];

    let query = admin
      .from("sdr_leads")
      .select(
        "id, first_name, last_name, email, company, role, country, language, campaign_id, metadata",
      )
      .eq("campaign_id", campaignId)
      .limit(80);

    if (leadIds.length > 0) {
      query = query.in("id", leadIds);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const leads = (rows ?? []) as Array<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      company: string | null;
      role: string | null;
      country: string | null;
      language: string;
      campaign_id: string;
      metadata: Record<string, unknown> | null;
    }>;

    const targets = onlyMissing
      ? leads.filter((l) => !l.country?.trim())
      : leads;

    if (targets.length === 0) {
      return json(200, { updated: 0, message: "No hay leads sin país que inferir." });
    }

    const { data: campaign } = await admin
      .from("sdr_campaigns")
      .select("agent_language")
      .eq("id", campaignId)
      .maybeSingle();
    const fallback = String(campaign?.agent_language ?? "es");

    const hints = await enrichLeadLocalesWithLlm(
      targets.map((l) => ({
        key: l.id,
        first_name: l.first_name,
        last_name: l.last_name,
        company: l.company,
        email: l.email,
        role: l.role,
        country: l.country,
      })),
      fallback,
    );

    let updated = 0;
    for (const lead of targets) {
      const hint = hints.get(lead.id);
      const country = hint?.country?.trim() || lead.country?.trim() || null;
      const language = hint?.language ||
        resolveLeadLanguage({
          country,
          email: lead.email,
          fallback: lead.language || fallback,
        });

      if (!country && language === (lead.language || fallback)) {
        // nothing useful
        continue;
      }

      const { error: updErr } = await admin
        .from("sdr_leads")
        .update({
          country,
          language,
          metadata: {
            ...(lead.metadata && typeof lead.metadata === "object" ? lead.metadata : {}),
            locale_inferred_at: new Date().toISOString(),
            locale_source: hint ? "openai" : "heuristic",
          },
        })
        .eq("id", lead.id);
      if (updErr) throw new Error(updErr.message);
      updated += 1;
    }

    return json(200, {
      campaign_id: campaignId,
      scanned: targets.length,
      updated,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("sdr-leads-infer-locale:", message);
    return json(500, { error: message });
  }
});
