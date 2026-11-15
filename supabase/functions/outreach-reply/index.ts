/**
 * POST /functions/v1/outreach-reply
 * Webhook Instantly/Smartlead. Guarda la respuesta y para la cadencia.
 * No contesta: a partir de ahí sigue una persona. Solo se envían los correos 1, 2 y 3.
 * Auth: header x-webhook-secret = WEBHOOK_SECRET (o Bearer).
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsHeaders,
  createAdmin,
  json,
  loadCampaign,
  outreachStopSequence,
  parseReplyPayload,
  inboundDeclines,
  verifyWebhookSecret,
  type SdrLeadRow,
} from "../_shared/sdr.ts";

const LEAD_SELECT =
  "id, campaign_id, first_name, last_name, email, company, role, country, language, industry, company_size, linkedin_url, apollo_id, status, consent_status, outreach_lead_id";

type Admin = ReturnType<typeof createAdmin>["admin"];

function ilikeExact(email: string): string {
  return email.replace(/[%_\\]/g, (ch) => `\\${ch}`);
}

/**
 * Match the inbound address to a lead. Smartlead's to_email can be an alias;
 * sl_lead_email is the address we uploaded. Try every candidate, then prefer
 * the lead that belongs to the campaign named in the webhook.
 */
async function findReplyLead(
  admin: Admin,
  body: Record<string, unknown>,
  emails: string[],
  campaignExternalId: string | null,
): Promise<SdrLeadRow | null> {
  if (body.sdr_lead_id) {
    const { data, error } = await admin
      .from("sdr_leads")
      .select(LEAD_SELECT)
      .eq("id", String(body.sdr_lead_id))
      .limit(1);
    if (error) throw new Error(error.message);
    return (data?.[0] ?? null) as SdrLeadRow | null;
  }

  const seen = new Set<string>();
  const rows: SdrLeadRow[] = [];
  for (const email of emails) {
    const { data, error } = await admin
      .from("sdr_leads")
      .select(LEAD_SELECT)
      .ilike("email", ilikeExact(email))
      .order("updated_at", { ascending: false })
      .limit(5);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const lead = row as SdrLeadRow;
      if (seen.has(lead.id)) continue;
      seen.add(lead.id);
      rows.push(lead);
    }
  }
  if (rows.length === 0) return null;

  let campaignRank = new Map<string, number>();
  if (campaignExternalId) {
    const ids = [...new Set(rows.map((row) => row.campaign_id))];
    const { data, error } = await admin
      .from("sdr_campaigns")
      .select("id, outreach_campaign_id")
      .in("id", ids);
    if (error) throw new Error(error.message);
    campaignRank = new Map(
      (data ?? []).map((row) => [
        String(row.id),
        String(row.outreach_campaign_id ?? "") === campaignExternalId ? 0 : 1,
      ]),
    );
  }

  const emailRank = (row: SdrLeadRow) => {
    const email = (row.email ?? "").trim().toLowerCase();
    const index = emails.indexOf(email);
    return index === -1 ? emails.length : index;
  };
  rows.sort((a, b) => {
    const byCampaign = (campaignRank.get(a.campaign_id) ?? 1) - (campaignRank.get(b.campaign_id) ?? 1);
    if (byCampaign !== 0) return byCampaign;
    return emailRank(a) - emailRank(b);
  });
  return rows[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    if (!verifyWebhookSecret(req)) {
      return json(401, { error: "Webhook no autorizado" });
    }

    const { admin } = createAdmin();
    const raw = await req.json().catch(() => ({}));
    const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const parsed = parseReplyPayload(body);

    if (parsed.emails.length === 0) {
      return json(400, { error: "Payload sin email de lead." });
    }
    if (!parsed.message) {
      return json(400, { error: "Payload sin cuerpo de respuesta." });
    }

    const hardOptOut =
      parsed.event.includes("unsub") || inboundDeclines(parsed.message);

    const lead = await findReplyLead(admin, body, parsed.emails, parsed.campaignExternalId);
    if (!lead) {
      console.error("outreach-reply: lead no encontrado", parsed.emails.join(","));
      return json(404, { error: `Lead no encontrado para ${parsed.emails.join(", ")}` });
    }

    const campaign = await loadCampaign(admin, lead.campaign_id);

    if (parsed.campaignExternalId && !campaign.outreach_campaign_id) {
      await admin
        .from("sdr_campaigns")
        .update({ outreach_campaign_id: parsed.campaignExternalId })
        .eq("id", campaign.id);
      campaign.outreach_campaign_id = parsed.campaignExternalId;
    }

    let inboundAlreadyStored = false;
    if (parsed.externalMessageId) {
      const { data: existingInbound, error: existingError } = await admin
        .from("sdr_conversations")
        .select("id")
        .eq("lead_id", lead.id)
        .eq("sender", "prospect")
        .eq("external_message_id", parsed.externalMessageId)
        .limit(1);
      if (existingError) throw new Error(existingError.message);
      inboundAlreadyStored = (existingInbound ?? []).length > 0;

      const { data: existingReply, error: replyError } = await admin
        .from("sdr_conversations")
        .select("id")
        .eq("lead_id", lead.id)
        .eq("external_message_id", `reply-to:${parsed.externalMessageId}`)
        .limit(1);
      if (replyError) throw new Error(replyError.message);
      if (inboundAlreadyStored && (existingReply ?? []).length > 0) {
        return json(200, {
          ok: true,
          duplicate: true,
          lead_id: lead.id,
          campaign_id: campaign.id,
        });
      }
    }

    if (!inboundAlreadyStored) {
      const { error: insertError } = await admin.from("sdr_conversations").insert({
        lead_id: lead.id,
        campaign_id: campaign.id,
        sender: "prospect",
        subject: parsed.subject,
        message_body: parsed.message,
        intent: hardOptOut ? "unsubscribe" : null,
        sentiment: hardOptOut ? "negative" : null,
        external_message_id: parsed.externalMessageId,
      });
      if (insertError) throw new Error(insertError.message);
    }

    // Solo salen los correos 1, 2 y 3. En cuanto contestan, se para la cadencia.
    // La conversación la sigue una persona; no se genera ni se envía respuesta.
    const leadUpdate: Record<string, unknown> = {
      status: hardOptOut ? "unsubscribed" : "replied",
    };
    if (hardOptOut) {
      leadUpdate.consent_status = "unsubscribed";
      leadUpdate.unsubscribed_at = new Date().toISOString();
    }
    const { error: leadUpdateError } = await admin.from("sdr_leads").update(leadUpdate).eq("id", lead.id);
    if (leadUpdateError) throw new Error(leadUpdateError.message);

    await outreachStopSequence(
      campaign.outreach_provider,
      campaign.outreach_campaign_id,
      lead.email!,
    );

    if (hardOptOut) {
      const emailLower = lead.email!.toLowerCase();
      const { data: alreadySuppressed } = await admin
        .from("sales_suppression")
        .select("id")
        .ilike("domain_or_email", emailLower)
        .maybeSingle();
      if (!alreadySuppressed) {
        await admin.from("sales_suppression").insert({
          domain_or_email: emailLower,
          company_name: lead.company,
          reason: "unsubscribed",
        });
      }
    }

    return json(200, {
      ok: true,
      lead_id: lead.id,
      campaign_id: campaign.id,
      intent: hardOptOut ? "unsubscribe" : "replied",
      lead_status: hardOptOut ? "unsubscribed" : "replied",
      replied: false,
      stopped: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("outreach-reply:", message);
    return json(500, { error: message });
  }
});
