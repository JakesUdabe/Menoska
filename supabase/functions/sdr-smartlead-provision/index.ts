/**
 * POST /functions/v1/sdr-smartlead-provision
 * Actions:
 *  - list_accounts: lista buzones SMTP ya conectados en Smartlead
 *  - provision: crea campaña Smartlead + buzón exclusivo + secuencia 0/3/7 + webhook outreach-reply
 *  - repair_sequence: re-aplica secuencia 0/3/7 + schedule en una campaña Smartlead ya existente
 * Nunca envía por SMTP propio.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsHeaders,
  json,
  loadCampaign,
  requireCrm,
  smartleadActivateCampaign,
  smartleadCountCampaignLeads,
  smartleadEnsureOutreachReady,
  smartleadGetCampaign,
  smartleadGetCampaignAnalytics,
  smartleadListEmailAccounts,
  smartleadListSequences,
  smartleadProvisionCampaign,
  smartleadRenameCampaign,
  smartleadResumeCampaign,
  smartleadSyncExclusiveEmailAccount,
  syncCrmLeadStatusesFromSmartlead,
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
    const action = String(body.action ?? "provision").trim();

    if (action === "list_accounts") {
      const accounts = await smartleadListEmailAccounts();
      return json(200, {
        accounts: accounts.map((a) => ({
          id: a.id,
          from_email: a.from_email,
          from_name: a.from_name,
          type: a.type,
          is_smtp_success: a.is_smtp_success,
          max_email_per_day: a.max_email_per_day,
        })),
      });
    }

    if (action === "status") {
      const campaignId = String(body.campaign_id ?? "").trim();
      if (!campaignId) return json(400, { error: "campaign_id es obligatorio." });
      const campaign = await loadCampaign(admin, campaignId);
      const outreachId = String(
        body.outreach_campaign_id ?? campaign.outreach_campaign_id ?? "",
      ).trim();
      if (!outreachId) {
        return json(200, {
          campaign_id: campaignId,
          outreach_campaign_id: null,
          smartlead_status: null,
          linked: false,
        });
      }
      const camp = await smartleadGetCampaign(outreachId);
      const sequences = await smartleadListSequences(outreachId);
      const rawStatus = camp.status != null ? String(camp.status) : null;
      let analytics: Awaited<ReturnType<typeof smartleadGetCampaignAnalytics>> | null = null;
      let lead_count: number | null = null;
      try {
        analytics = await smartleadGetCampaignAnalytics(outreachId);
        lead_count = analytics.leads;
      } catch (err) {
        console.warn(
          "smartlead analytics skipped:",
          err instanceof Error ? err.message : err,
        );
        analytics = null;
        try {
          lead_count = await smartleadCountCampaignLeads(outreachId);
        } catch {
          lead_count = null;
        }
      }
      let sync: Awaited<ReturnType<typeof syncCrmLeadStatusesFromSmartlead>> | null = null;
      try {
        sync = await syncCrmLeadStatusesFromSmartlead(admin, campaignId, outreachId);
      } catch (err) {
        console.warn(
          "smartlead lead status sync skipped:",
          err instanceof Error ? err.message : err,
        );
        sync = null;
      }
      if (analytics) {
        try {
          const { data: metricRow } = await admin
            .from("sdr_campaigns")
            .select("metrics")
            .eq("id", campaignId)
            .maybeSingle();
          const metrics = (metricRow?.metrics && typeof metricRow.metrics === "object" &&
              !Array.isArray(metricRow.metrics))
            ? metricRow.metrics as Record<string, unknown>
            : {};
          const smartlead = (metrics.smartlead && typeof metrics.smartlead === "object" &&
              !Array.isArray(metrics.smartlead))
            ? metrics.smartlead as Record<string, unknown>
            : {};
          await admin.from("sdr_campaigns").update({
            metrics: {
              ...metrics,
              smartlead: {
                ...smartlead,
                lead_count,
                analytics,
                fetched_at: new Date().toISOString(),
              },
            },
          }).eq("id", campaignId);
        } catch (err) {
          console.warn(
            "smartlead analytics cache skipped:",
            err instanceof Error ? err.message : err,
          );
        }
      }
      return json(200, {
        campaign_id: campaignId,
        outreach_campaign_id: outreachId,
        smartlead_status: rawStatus,
        smartlead_name: camp.name != null ? String(camp.name) : null,
        sequences: sequences.length,
        lead_count,
        analytics,
        sync,
        linked: true,
      });
    }

    if (action === "rename") {
      const campaignId = String(body.campaign_id ?? "").trim();
      const name = String(body.name ?? "").trim();
      if (!campaignId) return json(400, { error: "campaign_id es obligatorio." });
      if (!name) return json(400, { error: "name es obligatorio." });
      const campaign = await loadCampaign(admin, campaignId);
      const outreachId = String(
        body.outreach_campaign_id ?? campaign.outreach_campaign_id ?? "",
      ).trim();
      if (!outreachId) {
        return json(400, {
          error: "Esta campaña no tiene outreach_campaign_id de Smartlead.",
        });
      }
      await smartleadRenameCampaign(outreachId, name);
      await admin.from("sdr_campaigns").update({ name }).eq("id", campaignId);
      return json(200, {
        campaign_id: campaignId,
        outreach_campaign_id: outreachId,
        name,
        renamed_smartlead: true,
      });
    }

    if (action === "repair_sequence" || action === "start") {
      const campaignId = String(body.campaign_id ?? "").trim();
      if (!campaignId) return json(400, { error: "campaign_id es obligatorio." });
      const campaign = await loadCampaign(admin, campaignId);
      const outreachId = String(
        body.outreach_campaign_id ?? campaign.outreach_campaign_id ?? "",
      ).trim();
      if (!outreachId) {
        return json(400, { error: "Falta outreach_campaign_id de Smartlead." });
      }

      let emailAccountId = Number(body.email_account_id);
      if (!Number.isFinite(emailAccountId) || emailAccountId <= 0) {
        const { data: row } = await admin
          .from("sdr_campaigns")
          .select("metrics")
          .eq("id", campaignId)
          .maybeSingle();
        const m = row?.metrics && typeof row.metrics === "object" && !Array.isArray(row.metrics)
          ? (row.metrics as Record<string, unknown>)
          : {};
        const sl = m.smartlead && typeof m.smartlead === "object"
          ? (m.smartlead as Record<string, unknown>)
          : {};
        emailAccountId = Number(sl.email_account_id ?? 0);
      }

      // start = guarda el horario y reanuda. No reescribe la secuencia.
      // repair_sequence + start:true = reparar secuencia y luego arrancar.
      if (action === "start") {
        try {
          const resumed = await smartleadResumeCampaign(outreachId, campaign.settings);
          await admin
            .from("sdr_campaigns")
            .update({ status: "running" })
            .eq("id", campaignId);
          return json(200, {
            campaign_id: campaignId,
            outreach_campaign_id: outreachId,
            started: true,
            smartlead_status: resumed.smartlead_status,
          });
        } catch (err) {
          const start_error = err instanceof Error ? err.message : String(err);
          let diagnose: Record<string, unknown> = {};
          try {
            const camp = await smartleadGetCampaign(outreachId);
            diagnose = { smartlead_status: camp.status ?? null };
          } catch {
            /* ignore */
          }
          return json(502, {
            error: start_error,
            campaign_id: campaignId,
            outreach_campaign_id: outreachId,
            diagnose,
          });
        }
      }

      if (body.start === true) {
        try {
          const activated = await smartleadActivateCampaign({
            campaignId: outreachId,
            settings: campaign.settings,
            emailAccountId: Number.isFinite(emailAccountId) && emailAccountId > 0
              ? emailAccountId
              : null,
          });
          await admin
            .from("sdr_campaigns")
            .update({ status: "running" })
            .eq("id", campaignId);
          return json(200, {
            campaign_id: campaignId,
            outreach_campaign_id: outreachId,
            repaired: true,
            started: true,
            smartlead_status: activated.smartlead_status,
            cadence: {
              followup_day: campaign.settings.followup_day,
              reminder_day: campaign.settings.reminder_day,
            },
          });
        } catch (err) {
          const start_error = err instanceof Error ? err.message : String(err);
          let diagnose: Record<string, unknown> = {};
          try {
            const [camp, seqs] = await Promise.all([
              smartleadGetCampaign(outreachId),
              smartleadListSequences(outreachId),
            ]);
            diagnose = {
              smartlead_status: camp.status ?? null,
              sequences: seqs.length,
              has_scheduler: camp.scheduler_cron_value != null ||
                camp.schedule_start_time != null,
            };
          } catch {
            /* ignore diagnose errors */
          }
          return json(502, {
            error: start_error,
            campaign_id: campaignId,
            outreach_campaign_id: outreachId,
            diagnose,
          });
        }
      }

      await smartleadEnsureOutreachReady(outreachId, campaign.settings);
      if (Number.isFinite(emailAccountId) && emailAccountId > 0) {
        await smartleadSyncExclusiveEmailAccount(outreachId, emailAccountId);
      }

      return json(200, {
        campaign_id: campaignId,
        outreach_campaign_id: outreachId,
        repaired: true,
        started: false,
        cadence: {
          followup_day: campaign.settings.followup_day,
          reminder_day: campaign.settings.reminder_day,
        },
      });
    }

    if (action !== "provision") {
      return json(400, { error: `Acción no soportada: ${action}` });
    }

    const campaignId = String(body.campaign_id ?? "").trim();
    if (!campaignId) return json(400, { error: "campaign_id es obligatorio." });

    const emailAccountId = Number(body.email_account_id);
    if (!Number.isFinite(emailAccountId) || emailAccountId <= 0) {
      return json(400, { error: "email_account_id de Smartlead es obligatorio." });
    }

    const campaign = await loadCampaign(admin, campaignId);
    const name = String(body.name ?? campaign.name ?? "Proposalyze SDR").trim();
    const forceNew = body.force_new === true;
    const existingOutreachId = String(
      body.outreach_campaign_id ?? campaign.outreach_campaign_id ?? "",
    ).trim();

    // Por defecto reutiliza la campaña Smartlead ya vinculada (no crea otra).
    // Solo force_new=true crea una campaña nueva en Smartlead.
    if (existingOutreachId && !forceNew) {
      // Nunca START con 0 leads: Smartlead deja la campaña en COMPLETED vacía.
      const existingLeadCount = await smartleadCountCampaignLeads(existingOutreachId)
        .catch(() => 0);
      if (existingLeadCount > 0) {
        await smartleadActivateCampaign({
          campaignId: existingOutreachId,
          settings: campaign.settings,
          emailAccountId,
        }).catch(async (err) => {
          console.warn(
            "provision reuse activate:",
            err instanceof Error ? err.message : err,
          );
          await smartleadEnsureOutreachReady(existingOutreachId, campaign.settings);
          await smartleadSyncExclusiveEmailAccount(existingOutreachId, emailAccountId);
        });
      } else {
        await smartleadEnsureOutreachReady(existingOutreachId, campaign.settings);
        await smartleadSyncExclusiveEmailAccount(existingOutreachId, emailAccountId);
      }

      const { data: row } = await admin
        .from("sdr_campaigns")
        .select("metrics")
        .eq("id", campaignId)
        .maybeSingle();
      const metricsBase =
        row?.metrics && typeof row.metrics === "object" && !Array.isArray(row.metrics)
          ? (row.metrics as Record<string, unknown>)
          : {};
      const prevSl = metricsBase.smartlead && typeof metricsBase.smartlead === "object"
        ? (metricsBase.smartlead as Record<string, unknown>)
        : {};

      await admin
        .from("sdr_campaigns")
        .update({
          outreach_provider: "smartlead",
          outreach_campaign_id: existingOutreachId,
          metrics: {
            ...metricsBase,
            smartlead: {
              ...prevSl,
              email_account_id: emailAccountId,
              reused_at: new Date().toISOString(),
            },
          },
        })
        .eq("id", campaignId);

      return json(200, {
        campaign_id: campaignId,
        outreach_provider: "smartlead",
        outreach_campaign_id: existingOutreachId,
        email_account_id: emailAccountId,
        webhook_id: prevSl.webhook_id ?? null,
        reused: true,
        exclusive_mailbox: true,
      });
    }

    const provisioned = await smartleadProvisionCampaign({
      name,
      emailAccountId,
      supabaseUrl: auth.supabaseUrl,
      settings: campaign.settings,
    });

    const { data: row } = await admin
      .from("sdr_campaigns")
      .select("metrics")
      .eq("id", campaignId)
      .maybeSingle();
    const metricsBase =
      row?.metrics && typeof row.metrics === "object" && !Array.isArray(row.metrics)
        ? (row.metrics as Record<string, unknown>)
        : {};

    await admin
      .from("sdr_campaigns")
      .update({
        outreach_provider: "smartlead",
        outreach_campaign_id: provisioned.outreach_campaign_id,
        metrics: {
          ...metricsBase,
          smartlead: {
            email_account_id: provisioned.email_account_id,
            webhook_id: provisioned.webhook_id,
            provisioned_at: new Date().toISOString(),
          },
        },
      })
      .eq("id", campaignId);

    return json(200, {
      campaign_id: campaignId,
      outreach_provider: "smartlead",
      outreach_campaign_id: provisioned.outreach_campaign_id,
      email_account_id: provisioned.email_account_id,
      webhook_id: provisioned.webhook_id,
      webhook_url: provisioned.webhook_url,
      reused: false,
      exclusive_mailbox: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("sdr-smartlead-provision:", message);
    return json(500, { error: message });
  }
});
