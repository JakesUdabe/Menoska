import { supabase } from "@dashboard/integrations/supabase/client";
import { compareLeadsByPriority } from "./leadPriority";
import { resolveStartupId, salesFrom } from "./salesDb";
import type {
  LeadFilters,
  OutboundDraft,
  OutboundDraftStatus,
  SalesLead,
  SalesLeadStatus,
} from "./types";

const LEAD_COLUMNS =
  "id, name, email, company_name, cif, company_website, linkedin_url, industry, company_size, position, status, startup_id, exclusion_tag, last_contacted_at";

const DRAFT_COLUMNS =
  `id, lead_id, startup_id, subject, body, status, ai_context, dedup_badge, generated_at, validated_at, scheduled_at, sent_at, lead:sales_leads(${LEAD_COLUMNS})`;

export type GenerateDraftsResult = {
  created: OutboundDraft[];
  rewritten: OutboundDraft | null;
  skipped: Array<{ lead_id: string; reason: string; badge: string; tag: string | null }>;
};

export type GenerateDraftsOptions = {
  instruction?: string;
  overrideCompanyLeadIds?: string[];
  /** Reescribe un borrador pending_validation en lugar de crear otro. */
  draftId?: string;
  /** Permite generar follow-up aunque ya exista un envío previo a esa persona. */
  allowFollowUp?: boolean;
};

async function invokeError(
  error: { message?: string; context?: unknown } | null,
  data: { error?: string } | null,
): Promise<string | null> {
  if (data && typeof data.error === "string" && data.error) return data.error;
  const context = error?.context;
  if (context instanceof Response) {
    const body = await context.clone().json().catch(() => null) as { error?: string } | null;
    if (body?.error) return body.error;
  }
  return error?.message ?? null;
}

export async function fetchLeads(startupId: string, filters: LeadFilters = {}): Promise<SalesLead[]> {
  const id = await resolveStartupId(startupId);
  let query = salesFrom("sales_leads")
    .select(LEAD_COLUMNS)
    .eq("startup_id", id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.companySize && filters.companySize !== "all") query = query.eq("company_size", filters.companySize);
  if (filters.industry?.trim()) query = query.ilike("industry", `%${filters.industry.trim()}%`);
  if (filters.lastContactedOnOrBefore) {
    const end = `${filters.lastContactedOnOrBefore}T23:59:59.999Z`;
    query = query.or(`last_contacted_at.is.null,last_contacted_at.lte.${end}`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as SalesLead[]).slice().sort(compareLeadsByPriority);
}

export type SalesLeadPatch = {
  name: string;
  email: string;
  company_name: string;
  company_website: string | null;
  linkedin_url: string | null;
  industry: string | null;
  company_size: string | null;
  position: string | null;
  status: SalesLeadStatus;
};

function splitPersonName(fullName: string): { nombre: string; apellido: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { nombre: "", apellido: "" };
  if (parts.length === 1) return { nombre: parts[0]!, apellido: "" };
  return { nombre: parts[0]!, apellido: parts.slice(1).join(" ") };
}

function crmFaseFromSalesStatus(status: SalesLeadStatus): string {
  switch (status) {
    case "new":
      return "nuevo";
    case "contacted":
    case "replied":
      return "contactado";
    case "client":
      return "convertido";
    case "blacklisted":
      return "perdido";
    default:
      return "nuevo";
  }
}

/** Mirror Agente IA lead changes into the CRM leads tab (matched by email). */
async function syncCrmFromSalesLead(input: {
  matchEmails: string[];
  name: string;
  email: string;
  company_name: string;
  company_website: string | null;
  linkedin_url: string | null;
  position: string | null;
  status: SalesLeadStatus;
  comment?: string | null;
}): Promise<void> {
  const emails = [...new Set(input.matchEmails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (emails.length === 0) return;

  const { nombre, apellido } = splitPersonName(input.name);
  const now = new Date();
  const patch: Record<string, unknown> = {
    nombre,
    apellido,
    email: input.email.trim().toLowerCase(),
    empresa: input.company_name.trim(),
    web: input.company_website?.trim() || null,
    linkedin_url: input.linkedin_url?.trim() || null,
    cargo: input.position?.trim() || null,
    fase: crmFaseFromSalesStatus(input.status),
    is_converted: input.status === "client",
  };
  if (input.status === "contacted" || input.status === "replied") {
    patch.ultimo_contacto = now.toISOString().slice(0, 10);
  }
  if (input.comment) patch.comentarios = input.comment;

  // Match any of the previous/current emails (covers email renames).
  const orFilter = emails.map((e) => `email.ilike.${e}`).join(",");
  const { error } = await salesFrom("crm_leads")
    .update(patch)
    .or(orFilter)
    .neq("fase", "convertido");
  if (error) throw new Error(error.message);
}

/** Ensure a sent draft exists so the lead shows in Enviados y seguimiento. */
async function ensureSentDraftForLead(lead: {
  id: string;
  startup_id: string;
  email: string;
  name: string;
}): Promise<void> {
  const { data: existing, error: existingError } = await salesFrom("sales_outbound_drafts")
    .select("id")
    .eq("lead_id", lead.id)
    .in("status", ["approved", "sent"])
    .limit(1)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) return;

  const now = new Date().toISOString();
  const subject = `Outreach enviado — ${lead.name}`;
  const { data: draft, error: draftError } = await salesFrom("sales_outbound_drafts")
    .insert({
      lead_id: lead.id,
      startup_id: lead.startup_id,
      subject,
      body: "Correo registrado desde el Agente Comercial IA para seguimiento.",
      status: "sent",
      ai_context: "registro_manual_desde_agente",
      dedup_badge: "clean",
      generated_at: now,
      validated_at: now,
      sent_at: now,
    })
    .select("id")
    .single();
  if (draftError) throw new Error(draftError.message);

  const { error: logError } = await salesFrom("sales_email_logs").insert({
    draft_id: draft.id,
    lead_id: lead.id,
    startup_id: lead.startup_id,
    to_email: lead.email,
    subject,
    status: "sent",
    sent_at: now,
  });
  if (logError) throw new Error(logError.message);
}

export async function updateLead(leadId: string, patch: SalesLeadPatch): Promise<void> {
  const email = patch.email.trim().toLowerCase();
  if (!email.includes("@") || email.indexOf("@") < 1) {
    throw new Error("Email no válido");
  }

  const { data: before, error: beforeError } = await salesFrom("sales_leads")
    .select("id, email, startup_id, status")
    .eq("id", leadId)
    .maybeSingle();
  if (beforeError) throw new Error(beforeError.message);
  if (!before) throw new Error("Lead no encontrado");

  const now = new Date().toISOString();
  const salesPatch: Record<string, unknown> = {
    name: patch.name.trim(),
    email,
    company_name: patch.company_name.trim(),
    company_website: patch.company_website?.trim() || null,
    linkedin_url: patch.linkedin_url?.trim() || null,
    industry: patch.industry?.trim() || null,
    company_size: patch.company_size?.trim() || null,
    position: patch.position?.trim() || null,
    status: patch.status,
    updated_at: now,
  };
  if (patch.status === "contacted" || patch.status === "replied") {
    salesPatch.last_contacted_at = now;
  }
  const { error } = await salesFrom("sales_leads")
    .update(salesPatch)
    .eq("id", leadId);
  if (error) throw new Error(error.message);

  await syncCrmFromSalesLead({
    matchEmails: [before.email, email],
    name: patch.name,
    email,
    company_name: patch.company_name,
    company_website: patch.company_website,
    linkedin_url: patch.linkedin_url,
    position: patch.position,
    status: patch.status,
    comment:
      patch.status === "replied"
        ? "Contestó al outreach (Agente Comercial IA)."
        : patch.status === "contacted" && before.status !== "contacted"
          ? "Marcado contactado desde Agente Comercial IA."
          : null,
  });

  if (patch.status === "contacted" || patch.status === "replied") {
    await ensureSentDraftForLead({
      id: leadId,
      startup_id: before.startup_id,
      email,
      name: patch.name.trim(),
    });
  }
}

export async function deleteLead(leadId: string): Promise<void> {
  const { data: lead, error: leadError } = await salesFrom("sales_leads")
    .select("id, email")
    .eq("id", leadId)
    .maybeSingle();
  if (leadError) throw new Error(leadError.message);

  const { error } = await salesFrom("sales_leads").delete().eq("id", leadId);
  if (error) throw new Error(error.message);

  if (lead?.email) {
    const { error: crmError } = await salesFrom("crm_leads")
      .update({ archived: true })
      .ilike("email", lead.email)
      .neq("fase", "convertido");
    if (crmError) throw new Error(crmError.message);
  }
}

export async function generateOutreachDrafts(
  leadIds: string[],
  startupId: string,
  options: GenerateDraftsOptions = {},
): Promise<GenerateDraftsResult> {
  const { data, error } = await supabase.functions.invoke("sales-outreach-generate", {
    body: {
      startup_id: startupId,
      lead_ids: leadIds,
      instruction: options.instruction ?? null,
      override_company_lead_ids: options.overrideCompanyLeadIds ?? [],
      draft_id: options.draftId ?? null,
      allow_follow_up: options.allowFollowUp === true,
    },
  });
  const message = await invokeError(error, data);
  if (message) throw new Error(message);
  return {
    created: (data?.created ?? []) as OutboundDraft[],
    rewritten: (data?.rewritten ?? null) as OutboundDraft | null,
    skipped: (data?.skipped ?? []) as GenerateDraftsResult["skipped"],
  };
}

export async function fetchPendingDrafts(startupId: string): Promise<OutboundDraft[]> {
  const id = await resolveStartupId(startupId);
  const { data, error } = await salesFrom("sales_outbound_drafts")
    .select(DRAFT_COLUMNS)
    .eq("startup_id", id)
    .eq("status", "pending_validation")
    .order("generated_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as OutboundDraft[];
}

export async function fetchTrackedDrafts(startupId: string): Promise<OutboundDraft[]> {
  const id = await resolveStartupId(startupId);
  const { data, error } = await salesFrom("sales_outbound_drafts")
    .select(DRAFT_COLUMNS)
    .eq("startup_id", id)
    .in("status", ["approved", "sent", "failed"])
    .order("generated_at", { ascending: false })
    .limit(150);
  if (error) throw new Error(error.message);
  return (data ?? []) as OutboundDraft[];
}

export async function markOutreachReplied(draftId: string): Promise<void> {
  const { data: draft, error: draftError } = await salesFrom("sales_outbound_drafts")
    .select("id, lead_id, status")
    .eq("id", draftId)
    .maybeSingle();
  if (draftError) throw new Error(draftError.message);
  if (!draft) throw new Error("Borrador no encontrado");

  const now = new Date().toISOString();
  const { data: lead, error: leadError } = await salesFrom("sales_leads")
    .update({ status: "replied", updated_at: now, last_contacted_at: now })
    .eq("id", draft.lead_id)
    .select("id, email, name, company_name, company_website, linkedin_url, position, status")
    .maybeSingle();
  if (leadError) throw new Error(leadError.message);
  if (!lead) throw new Error("Lead no encontrado");

  await salesFrom("sales_email_logs")
    .update({ replied_at: now })
    .eq("draft_id", draftId)
    .is("replied_at", null);

  await syncCrmFromSalesLead({
    matchEmails: [lead.email],
    name: lead.name,
    email: lead.email,
    company_name: lead.company_name,
    company_website: lead.company_website,
    linkedin_url: lead.linkedin_url,
    position: lead.position,
    status: "replied",
    comment: "Contestó al outreach (Agente Comercial IA).",
  });
}

export async function markOutreachNoReply(draftId: string): Promise<void> {
  const { data: draft, error: draftError } = await salesFrom("sales_outbound_drafts")
    .select("id, lead_id")
    .eq("id", draftId)
    .maybeSingle();
  if (draftError) throw new Error(draftError.message);
  if (!draft) throw new Error("Borrador no encontrado");

  const now = new Date().toISOString();
  const { data: lead, error: leadError } = await salesFrom("sales_leads")
    .update({ status: "contacted", updated_at: now })
    .eq("id", draft.lead_id)
    .neq("status", "replied")
    .select("id, email, name, company_name, company_website, linkedin_url, position, status")
    .maybeSingle();
  if (leadError) throw new Error(leadError.message);
  if (!lead) return;

  await syncCrmFromSalesLead({
    matchEmails: [lead.email],
    name: lead.name,
    email: lead.email,
    company_name: lead.company_name,
    company_website: lead.company_website,
    linkedin_url: lead.linkedin_url,
    position: lead.position,
    status: "contacted",
    comment: "Sin respuesta al outreach (Agente Comercial IA).",
  });
}

export async function updateDraftStatus(
  draftId: string,
  status: OutboundDraftStatus,
  editedSubject?: string,
  editedBody?: string,
): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (editedSubject !== undefined) patch.subject = editedSubject;
  if (editedBody !== undefined) patch.body = editedBody;
  if (status === "approved" || status === "rejected") patch.validated_at = new Date().toISOString();
  const { error } = await salesFrom("sales_outbound_drafts").update(patch).eq("id", draftId);
  if (error) throw new Error(error.message);
}

export type CrmLeadLike = {
  id: string;
  nombre: string;
  apellido?: string | null;
  email: string;
  empresa: string;
  cif?: string | null;
  web?: string | null;
  linkedin_url?: string | null;
  cargo?: string | null;
};

function normalizeCrmCif(value: string | null | undefined): string | null {
  const cleaned = (value ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return cleaned.length >= 8 ? cleaned : null;
}

/** Find or create a sales_leads row for a CRM contact (matched by email). */
export async function ensureSalesLeadFromCrm(
  crm: CrmLeadLike,
  startupId: string,
): Promise<string> {
  const id = await resolveStartupId(startupId);
  const email = crm.email.trim().toLowerCase();
  if (!email.includes("@")) throw new Error("Email no válido");

  const cif = normalizeCrmCif(crm.cif);
  const companyName = crm.empresa.trim() || email;
  const name = [crm.nombre, crm.apellido].filter(Boolean).join(" ").trim()
    || crm.cargo?.trim()
    || companyName
    || email;

  const { data: existing, error: findError } = await salesFrom("sales_leads")
    .select("id")
    .eq("startup_id", id)
    .ilike("email", email)
    .limit(1)
    .maybeSingle();
  if (findError) throw new Error(findError.message);
  if (existing?.id) {
    const { error: syncError } = await salesFrom("sales_leads")
      .update({
        company_name: companyName,
        cif,
        company_website: crm.web?.trim() || null,
        linkedin_url: crm.linkedin_url?.trim() || null,
        position: crm.cargo?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (syncError) throw new Error(syncError.message);
    return existing.id as string;
  }

  const { data: inserted, error: insertError } = await salesFrom("sales_leads")
    .insert({
      startup_id: id,
      name,
      email,
      company_name: companyName,
      cif,
      company_website: crm.web?.trim() || null,
      linkedin_url: crm.linkedin_url?.trim() || null,
      position: crm.cargo?.trim() || null,
      status: "new",
    })
    .select("id")
    .single();
  if (insertError) throw new Error(insertError.message);
  return inserted.id as string;
}

/** Map email → best open draft (pending_validation preferred over approved). */
export async function fetchDraftsByEmails(
  startupId: string,
  emails: string[],
): Promise<Map<string, OutboundDraft>> {
  const map = new Map<string, OutboundDraft>();
  const cleaned = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@")))];
  if (cleaned.length === 0) return map;

  const id = await resolveStartupId(startupId);
  const { data: leads, error: leadError } = await salesFrom("sales_leads")
    .select("id, email")
    .eq("startup_id", id)
    .in("email", cleaned);
  if (leadError) throw new Error(leadError.message);
  const leadRows = (leads ?? []) as Array<{ id: string; email: string }>;
  if (leadRows.length === 0) return map;

  const leadIds = leadRows.map((l) => l.id);
  const emailByLead = new Map(leadRows.map((l) => [l.id, l.email.trim().toLowerCase()]));

  const { data: drafts, error: draftError } = await salesFrom("sales_outbound_drafts")
    .select(DRAFT_COLUMNS)
    .eq("startup_id", id)
    .in("lead_id", leadIds)
    .in("status", ["pending_validation", "approved"])
    .order("generated_at", { ascending: false })
    .limit(300);
  if (draftError) throw new Error(draftError.message);

  const rank = (status: string) => (status === "pending_validation" ? 0 : 1);
  for (const draft of (drafts ?? []) as OutboundDraft[]) {
    const email = emailByLead.get(draft.lead_id);
    if (!email) continue;
    const prev = map.get(email);
    if (!prev || rank(draft.status) < rank(prev.status)) {
      map.set(email, draft);
    }
  }
  return map;
}

/** Upsert sales lead from CRM and generate an AI outreach draft. */
export async function generateDraftForCrmLead(
  crm: CrmLeadLike,
  startupId: string,
  options: { instruction?: string; allowFollowUp?: boolean } = {},
): Promise<OutboundDraft> {
  const salesLeadId = await ensureSalesLeadFromCrm(crm, startupId);
  // CRM UI: the user decides — never block on person/company already contacted.
  const bypassDedup = options.allowFollowUp !== false;
  const result = await generateOutreachDrafts([salesLeadId], startupId, {
    instruction: options.instruction,
    allowFollowUp: bypassDedup,
    overrideCompanyLeadIds: bypassDedup ? [salesLeadId] : [],
  });
  const created = result.created[0];
  if (created) return created;
  if (result.skipped[0]) {
    throw new Error(result.skipped[0].reason || "No se pudo generar el borrador");
  }
  const map = await fetchDraftsByEmails(startupId, [crm.email]);
  const existing = map.get(crm.email.trim().toLowerCase());
  if (existing) return existing;
  throw new Error("No se generó ningún borrador");
}

/**
 * Approve/enqueue the current CRM message at any time.
 * Reuses an existing draft id when provided; otherwise creates an approved draft.
 */
export async function enqueueCrmOutreachDraft(input: {
  crm: CrmLeadLike;
  startupId: string;
  subject: string;
  body: string;
  draftId?: string | null;
}): Promise<OutboundDraft> {
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject) throw new Error("Indica un asunto para encolar el envío");
  if (!body) throw new Error("Indica el cuerpo del mensaje para encolar el envío");

  const startupId = await resolveStartupId(input.startupId);
  const salesLeadId = await ensureSalesLeadFromCrm(input.crm, startupId);
  const now = new Date().toISOString();

  if (input.draftId) {
    const { data, error } = await salesFrom("sales_outbound_drafts")
      .update({
        subject,
        body,
        status: "approved",
        validated_at: now,
      })
      .eq("id", input.draftId)
      .select(DRAFT_COLUMNS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data as OutboundDraft;
  }

  const { data, error } = await salesFrom("sales_outbound_drafts")
    .insert({
      lead_id: salesLeadId,
      startup_id: startupId,
      subject,
      body,
      status: "approved",
      ai_context: "encolado_manual_crm",
      dedup_badge: "clean",
      generated_at: now,
      validated_at: now,
    })
    .select(DRAFT_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as OutboundDraft;
}

export type RegisterOutreachResult = {
  ok: boolean;
  reason?: string;
  idempotent?: boolean;
  id?: string;
  contact_count?: number;
  fase?: string;
  ultimo_contacto?: string | null;
  proximo_contacto?: string | null;
};

/** Mark CRM lead as contacted (+1) and set next-contact date from pipeline timings. */
export async function registerOutreachContact(email: string): Promise<RegisterOutreachResult> {
  const { data, error } = await supabase.rpc("crm_register_outreach_contact", {
    p_email: email.trim().toLowerCase(),
    p_from: new Date().toISOString().slice(0, 10),
  });
  if (error) throw new Error(error.message);
  return (data ?? { ok: false }) as RegisterOutreachResult;
}
