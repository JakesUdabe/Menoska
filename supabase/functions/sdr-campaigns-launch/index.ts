/**
 * POST /functions/v1/sdr-campaigns-launch
 * Genera cadencia, importa TODOS los leads elegibles a Smartlead/Instantly y arranca.
 * Nunca envía por SMTP propio.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsHeaders,
  assertManualTemplates,
  coldBodyForSmartlead,
  generateSequenceCadence,
  instantlyAddLeads,
  manualCopyRevision,
  json,
  loadCampaign,
  markExhaustedLeadsLost,
  requireCrm,
  smartleadActivateCampaign,
  smartleadAddLeads,
  smartleadCountCampaignLeads,
  smartleadPrepareForLeadImport,
  smartleadResumeCampaign,
  type SdrLeadRow,
} from "../_shared/sdr.ts";

/** Smartlead acepta hasta 400; usamos chunks menores por tiempo de LLM. */
const CHUNK = 25;
const MAX_LEADS_PER_LAUNCH = 400;
const GEN_CONCURRENCY = 5;
/** La pasarela corta a los 150 s. Un lote corto termina y el panel pide el siguiente. */
const REGEN_BATCH = 4;
/** Sin LLM: un lote grande cabe en el tiempo de la función. */
const MANUAL_REGEN_BATCH = 80;
const REGEN_CONCURRENCY = 4;
const COPY_REVISION = "2";

async function countPendingRewrite(
  // deno-lint-ignore no-explicit-any
  admin: any,
  campaignId: string,
  revision: string,
): Promise<number> {
  const { count, error } = await admin
    .from("sdr_leads")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .in("status", ["discovered", "queued", "contacted"])
    .neq("consent_status", "unsubscribed")
    .neq("consent_status", "suppressed")
    .not("email", "is", null)
    .or(`metadata->>copy_revision.is.null,metadata->>copy_revision.neq.${revision}`);
  if (error) throw new Error(error.message);
  return Number(count ?? 0);
}

type CadenceSteps = {
  step1: { subject: string; body: string };
  step2: { subject: string; body: string };
  step3: { subject: string; body: string };
};

async function loadStoredCadence(
  // deno-lint-ignore no-explicit-any
  admin: any,
  campaignId: string,
  leadIds: string[],
): Promise<Map<string, CadenceSteps>> {
  const empty = { subject: "", body: "" };
  const map = new Map<string, CadenceSteps>();
  if (leadIds.length === 0) return map;
  const { data } = await admin
    .from("sdr_conversations")
    .select("lead_id, intent, subject, message_body")
    .eq("campaign_id", campaignId)
    .in("lead_id", leadIds)
    .in("intent", ["outreach_step_1", "outreach_step_2", "outreach_step_3"])
    .order("created_at", { ascending: false });
  for (const row of data ?? []) {
    const leadId = String(row.lead_id ?? "");
    if (!leadId) continue;
    const cur = map.get(leadId) ?? {
      step1: { ...empty },
      step2: { ...empty },
      step3: { ...empty },
    };
    const subject = String(row.subject ?? "").trim();
    const body = String(row.message_body ?? "").trim();
    if (!subject || !body) continue;
    if (row.intent === "outreach_step_1" && !cur.step1.body) {
      cur.step1 = { subject, body };
    } else if (row.intent === "outreach_step_2" && !cur.step2.body) {
      cur.step2 = { subject, body };
    } else if (row.intent === "outreach_step_3" && !cur.step3.body) {
      cur.step3 = { subject, body };
    }
    map.set(leadId, cur);
  }
  for (const [id, cadence] of map) {
    if (!cadence.step1.body) map.delete(id);
  }
  return map;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

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

    const campaign = await loadCampaign(admin, campaignId);
    if (!campaign.outreach_campaign_id && !body.outreach_campaign_id) {
      return json(400, {
        error: "Configura outreach_campaign_id (ID de campaña en Smartlead/Instantly).",
      });
    }

    const outreachCampaignId = String(
      body.outreach_campaign_id ?? campaign.outreach_campaign_id ?? "",
    ).trim();
    const provider = (body.outreach_provider ?? campaign.outreach_provider) as
      | "smartlead"
      | "instantly";

    if (body.agent_prompt || body.calendly_url || body.agent_language || body.outreach_campaign_id) {
      await admin
        .from("sdr_campaigns")
        .update({
          agent_prompt: typeof body.agent_prompt === "string"
            ? body.agent_prompt
            : campaign.agent_prompt,
          calendly_url: typeof body.calendly_url === "string"
            ? body.calendly_url
            : campaign.calendly_url,
          agent_language: typeof body.agent_language === "string"
            ? body.agent_language
            : campaign.agent_language,
          outreach_provider: provider,
          outreach_campaign_id: outreachCampaignId,
        })
        .eq("id", campaignId);
      Object.assign(campaign, {
        agent_prompt: typeof body.agent_prompt === "string"
          ? body.agent_prompt
          : campaign.agent_prompt,
        calendly_url: typeof body.calendly_url === "string"
          ? body.calendly_url
          : campaign.calendly_url,
        agent_language: typeof body.agent_language === "string"
          ? body.agent_language
          : campaign.agent_language,
        outreach_provider: provider,
        outreach_campaign_id: outreachCampaignId,
      });
    }

    const settings = campaign.settings;
    const regenerateCopy = body.regenerate_copy === true;
    const manualCopy = settings.copy_mode === "manual";
    const copyRevision = manualCopy ? manualCopyRevision(settings) : COPY_REVISION;
    const markedLost = regenerateCopy
      ? 0
      : await markExhaustedLeadsLost(
        admin,
        campaignId,
        settings.lost_after_days,
      );

    // Regenerar no reescribe la secuencia: solo los textos del lead.
    // Pausar aquí dejó la campaña en PAUSED cuando la función murió por timeout.
    if (provider === "smartlead" && !regenerateCopy) {
      await smartleadPrepareForLeadImport(outreachCampaignId, settings);
    }

    const selectCols =
      "id, campaign_id, first_name, last_name, email, company, role, country, language, industry, company_size, linkedin_url, apollo_id, status, consent_status, outreach_lead_id";

    let query = admin
      .from("sdr_leads")
      .select(selectCols)
      .eq("campaign_id", campaignId)
      .eq("status", "discovered")
      .neq("consent_status", "unsubscribed")
      .neq("consent_status", "suppressed")
      .not("email", "is", null)
      .limit(MAX_LEADS_PER_LAUNCH);

    if (Array.isArray(body.lead_ids) && body.lead_ids.length > 0) {
      query = admin
        .from("sdr_leads")
        .select(selectCols)
        .eq("campaign_id", campaignId)
        .in("id", body.lead_ids.slice(0, MAX_LEADS_PER_LAUNCH));
    } else if (body.relaunch_contacted === true || regenerateCopy) {
      query = admin
        .from("sdr_leads")
        .select(selectCols)
        .eq("campaign_id", campaignId)
        .in("status", ["discovered", "queued", "contacted"])
        .neq("consent_status", "unsubscribed")
        .neq("consent_status", "suppressed")
        .not("email", "is", null)
        .order("id", { ascending: true })
        .limit(regenerateCopy ? (manualCopy ? MANUAL_REGEN_BATCH : REGEN_BATCH) : MAX_LEADS_PER_LAUNCH);
      if (regenerateCopy) {
        query = query.or(
          `metadata->>copy_revision.is.null,metadata->>copy_revision.neq.${copyRevision}`,
        );
      }
    }

    const { data: leads, error: leadsError } = await query;
    if (leadsError) throw new Error(leadsError.message);

    const eligible = ((leads ?? []) as SdrLeadRow[]).filter((l) => {
      if (!l.email || !l.email.includes("@")) return false;
      if (l.consent_status === "unsubscribed" || l.consent_status === "suppressed") return false;
      if (l.status === "unsubscribed" || l.status === "bounced" || l.status === "lost") return false;
      if (["replied", "demo_requested", "demo_scheduled"].includes(l.status)) return false;
      return true;
    });

    if (eligible.length === 0) {
      if (regenerateCopy) {
        let startWarning: string | null = null;
        if (provider === "smartlead") {
          try {
            await smartleadResumeCampaign(outreachCampaignId, settings);
          } catch (err) {
            startWarning = err instanceof Error ? err.message : String(err);
          }
        }
        return json(200, {
          campaign_id: campaignId,
          provider,
          launched: 0,
          uploaded: 0,
          updated: 0,
          remaining: 0,
          done: true,
          marked_lost: markedLost,
          start_warning: startWarning,
        });
      }
      return json(400, {
        error:
          "No hay leads elegibles (discovered + email). Si ya están en cola o contacted tras un intento fallido, selecciónalos en Leads y lanza de nuevo, o pasa relaunch_contacted=true.",
        marked_lost: markedLost,
      });
    }

    type Prepared = {
      lead: SdrLeadRow;
      step1: { subject: string; body: string };
      step2: { subject: string; body: string };
      step3: { subject: string; body: string };
      reused: boolean;
    };

    const storedCadence = regenerateCopy
      ? new Map<string, CadenceSteps>()
      : await loadStoredCadence(
        admin,
        campaignId,
        eligible.map((l) => l.id),
      );

    if (
      manualCopy &&
      (regenerateCopy || eligible.some((lead) => !storedCadence.get(lead.id)?.step1.body))
    ) {
      assertManualTemplates(settings);
    }

    const allPrepared: Prepared[] = [];
    let uploadedTotal = 0;
    let updatedTotal = 0;

    for (let offset = 0; offset < eligible.length; offset += CHUNK) {
      const slice = eligible.slice(offset, offset + CHUNK);
      const prepared = await mapPool(
        slice,
        regenerateCopy ? REGEN_CONCURRENCY : GEN_CONCURRENCY,
        async (lead) => {
        const cached = storedCadence.get(lead.id);
        if (cached?.step1.body) {
          return { lead, ...cached, reused: true } as Prepared;
        }
        const cadence = await generateSequenceCadence({ campaign, lead });
        return { lead, ...cadence, reused: false } as Prepared;
      });

      const fresh = prepared.filter((item) => !item.reused);
      if (regenerateCopy && fresh.length > 0) {
        const { error: deleteError } = await admin
          .from("sdr_conversations")
          .delete()
          .eq("campaign_id", campaignId)
          .in("lead_id", fresh.map((item) => item.lead.id))
          .in("intent", ["outreach_step_1", "outreach_step_2", "outreach_step_3"]);
        if (deleteError) throw new Error(deleteError.message);
      }

      for (const item of fresh) {
        const convRows = [
          {
            lead_id: item.lead.id,
            campaign_id: campaignId,
            sender: "agent",
            subject: item.step1.subject,
            message_body: item.step1.body,
            intent: "outreach_step_1",
            sentiment: "neutral",
          },
          item.step2.body
            ? {
              lead_id: item.lead.id,
              campaign_id: campaignId,
              sender: "agent",
              subject: item.step2.subject,
              message_body: item.step2.body,
              intent: "outreach_step_2",
              sentiment: "neutral",
            }
            : null,
          item.step3.body
            ? {
              lead_id: item.lead.id,
              campaign_id: campaignId,
              sender: "agent",
              subject: item.step3.subject,
              message_body: item.step3.body,
              intent: "outreach_step_3",
              sentiment: "neutral",
            }
            : null,
        ].filter(Boolean);
        const { error: insertError } = await admin.from("sdr_conversations").insert(convRows);
        if (insertError) throw new Error(insertError.message);
      }

      const payload = prepared.map(({ lead, step1, step2, step3 }) => ({
        email: lead.email!,
        first_name: lead.first_name,
        last_name: lead.last_name,
        company_name: lead.company,
        custom_fields: {
          subject: step1.subject,
          body: coldBodyForSmartlead(step1.body),
          subject_2: step2.subject,
          body_2: coldBodyForSmartlead(step2.body),
          subject_3: step3.subject,
          body_3: coldBodyForSmartlead(step3.body),
          role: lead.role ?? "",
          language: lead.language ?? "",
          sdr_lead_id: lead.id,
          company: lead.company ?? "",
        },
        custom_variables: {
          subject: step1.subject,
          body: step1.body,
          subject_2: step2.subject,
          body_2: step2.body,
          subject_3: step3.subject,
          body_3: step3.body,
          role: lead.role ?? "",
          language: lead.language ?? "",
          sdr_lead_id: lead.id,
        },
      }));

      // Importado ≠ email enviado. queued hasta que Smartlead confirme al menos un envío.
      const upload = provider === "instantly"
        ? await instantlyAddLeads(outreachCampaignId, payload)
        : await smartleadAddLeads(outreachCampaignId, payload);

      uploadedTotal += upload.uploaded;
      updatedTotal += "updated" in upload ? Number(upload.updated ?? 0) : 0;
      allPrepared.push(...prepared);

      const now = new Date().toISOString();
      for (const item of prepared) {
        await admin
          .from("sdr_leads")
          .update({
            status: regenerateCopy && item.lead.status === "contacted" ? "contacted" : "queued",
            outreach_lead_id: outreachCampaignId,
            metadata: {
              sequence_cadence: {
                followup_day: settings.followup_day,
                reminder_day: settings.reminder_day,
                enable_followup: settings.enable_followup,
                enable_reminder: settings.enable_reminder,
                lost_after_days: settings.lost_after_days,
              },
              started_at: now,
              uploaded_to: provider,
              smartlead_uploaded_at: now,
              ...(regenerateCopy ? { copy_revision: copyRevision } : {}),
            },
          })
          .eq("id", item.lead.id);
      }
    }

    let smartleadLeadCount: number | null = null;
    if (provider === "smartlead") {
      try {
        smartleadLeadCount = await smartleadCountCampaignLeads(outreachCampaignId);
      } catch {
        smartleadLeadCount = null;
      }
      if (
        smartleadLeadCount != null &&
        smartleadLeadCount <= 0 &&
        uploadedTotal + updatedTotal <= 0
      ) {
        return json(502, {
          error:
            `Smartlead sigue con 0 leads tras el import (CRM preparó ${allPrepared.length}). ` +
            `Revisa que la campaña ${outreachCampaignId} no esté COMPLETED vacía.`,
          campaign_id: campaignId,
          launched: allPrepared.length,
          uploaded: uploadedTotal,
          updated: updatedTotal,
          smartlead_lead_count: 0,
        });
      }
    }

    let startWarning: string | null = null;
    if (provider === "smartlead" && regenerateCopy) {
      try {
        await smartleadResumeCampaign(outreachCampaignId, settings);
      } catch (err) {
        startWarning = err instanceof Error ? err.message : String(err);
        console.error("smartlead resume after rewrite:", startWarning);
      }
    } else if (provider === "smartlead" && (uploadedTotal > 0 || updatedTotal > 0 || (smartleadLeadCount ?? 0) > 0)) {
      try {
        const metricsRow = await admin
          .from("sdr_campaigns")
          .select("metrics")
          .eq("id", campaignId)
          .maybeSingle();
        const m = metricsRow.data?.metrics &&
            typeof metricsRow.data.metrics === "object" &&
            !Array.isArray(metricsRow.data.metrics)
          ? (metricsRow.data.metrics as Record<string, unknown>)
          : {};
        const sl = m.smartlead && typeof m.smartlead === "object"
          ? (m.smartlead as Record<string, unknown>)
          : {};
        const emailAccountId = Number(sl.email_account_id ?? 0);
        await smartleadActivateCampaign({
          campaignId: outreachCampaignId,
          settings,
          emailAccountId: Number.isFinite(emailAccountId) && emailAccountId > 0
            ? emailAccountId
            : null,
        });
      } catch (err) {
        startWarning = err instanceof Error ? err.message : String(err);
        console.error("smartlead start after launch:", startWarning);
      }
    }

    await admin
      .from("sdr_campaigns")
      .update({
        status: startWarning ? "ready" : "running",
        outreach_provider: provider,
        outreach_campaign_id: outreachCampaignId,
      })
      .eq("id", campaignId);

    const remaining = regenerateCopy
      ? await countPendingRewrite(admin, campaignId, copyRevision)
      : 0;

    if (!regenerateCopy && uploadedTotal + updatedTotal <= 0 && (smartleadLeadCount == null || smartleadLeadCount <= 0)) {
      return json(502, {
        error: "No se importó ningún lead a Smartlead/Instantly.",
        campaign_id: campaignId,
        launched: 0,
        uploaded: 0,
        updated: 0,
        smartlead_lead_count: smartleadLeadCount,
      });
    }

    if (!regenerateCopy && startWarning) {
      return json(502, {
        error:
          `Leads en Smartlead (nuevos=${uploadedTotal}, actualizados=${updatedTotal}/${allPrepared.length}` +
          `${smartleadLeadCount != null ? `, total=${smartleadLeadCount}` : ""}) ` +
          `pero Smartlead no arrancó. Pulsa Arrancar Smartlead. Detalle: ${startWarning}`,
        campaign_id: campaignId,
        provider,
        launched: allPrepared.length,
        uploaded: uploadedTotal,
        updated: updatedTotal,
        smartlead_lead_count: smartleadLeadCount,
        marked_lost: markedLost,
        start_error: startWarning,
      });
    }

    return json(200, {
      campaign_id: campaignId,
      provider,
      launched: allPrepared.length,
      uploaded: uploadedTotal,
      updated: updatedTotal,
      smartlead_lead_count: smartleadLeadCount,
      reused_cadence: allPrepared.filter((p) => p.reused).length,
      marked_lost: markedLost,
      cadence: {
        followup_day: settings.followup_day,
        reminder_day: settings.reminder_day,
        enable_followup: settings.enable_followup,
        enable_reminder: settings.enable_reminder,
        lost_after_days: settings.lost_after_days,
      },
      lead_ids: allPrepared.map((p) => p.lead.id),
      remaining,
      done: regenerateCopy ? remaining === 0 : true,
      start_warning: startWarning,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("sdr-campaigns-launch:", message);
    return json(500, { error: message });
  }
});
