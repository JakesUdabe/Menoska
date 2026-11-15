import { supabase } from "@dashboard/integrations/supabase/client";
import type {
  SdrCampaign,
  SdrCampaignSettings,
  SdrConversation,
  SdrLead,
  SdrMetrics,
  SmartleadCampaignAnalytics,
} from "./types";
import { DEFAULT_SDR_PROMPT, DEFAULT_SDR_SETTINGS, normalizeSdrSettings } from "./types";

function mapCampaign(row: Record<string, unknown>): SdrCampaign {
  return {
    ...(row as unknown as SdrCampaign),
    settings: normalizeSdrSettings(row.settings),
  };
}

function asMetrics(value: unknown): SdrMetrics {
  const m = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    leads_processed: Number(m.leads_processed ?? 0) || 0,
    emails_sent: Number(m.emails_sent ?? 0) || 0,
    replies: Number(m.replies ?? 0) || 0,
    demos_scheduled: Number(m.demos_scheduled ?? 0) || 0,
    unsubscribed: Number(m.unsubscribed ?? 0) || 0,
    conversion_rate: Number(m.conversion_rate ?? 0) || 0,
  };
}

export async function listSdrCampaigns(): Promise<SdrCampaign[]> {
  const { data, error } = await supabase
    .from("sdr_campaigns")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapCampaign(row as Record<string, unknown>));
}

export async function createSdrCampaign(input: {
  name: string;
  agent_language?: string;
  agent_prompt?: string;
  calendly_url?: string | null;
  outreach_provider?: string;
  outreach_campaign_id?: string | null;
  target_roles?: string[];
  target_countries?: string[];
  target_industries?: string[];
  target_company_sizes?: string[];
  settings?: Partial<SdrCampaignSettings>;
}): Promise<SdrCampaign> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("sdr_campaigns")
    .insert({
      name: input.name.trim(),
      agent_language: input.agent_language ?? "es",
      agent_prompt: input.agent_prompt?.trim() || DEFAULT_SDR_PROMPT,
      calendly_url: input.calendly_url?.trim() || null,
      outreach_provider: input.outreach_provider ?? "smartlead",
      outreach_campaign_id: input.outreach_campaign_id?.trim() || null,
      target_roles: input.target_roles ?? [],
      target_countries: input.target_countries ?? [],
      target_industries: input.target_industries ?? [],
      target_company_sizes: input.target_company_sizes ?? [],
      settings: normalizeSdrSettings(input.settings ?? DEFAULT_SDR_SETTINGS),
      created_by: userData.user?.id ?? null,
      status: "draft",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapCampaign(data as Record<string, unknown>);
}

export async function updateSdrCampaign(
  id: string,
  patch: Partial<SdrCampaign>,
): Promise<SdrCampaign> {
  const { data, error } = await supabase
    .from("sdr_campaigns")
    .update({
      name: patch.name,
      target_roles: patch.target_roles,
      target_countries: patch.target_countries,
      target_industries: patch.target_industries,
      target_company_sizes: patch.target_company_sizes,
      agent_language: patch.agent_language,
      agent_prompt: patch.agent_prompt,
      calendly_url: patch.calendly_url,
      outreach_provider: patch.outreach_provider,
      outreach_campaign_id: patch.outreach_campaign_id,
      status: patch.status,
      ...(patch.settings != null
        ? { settings: normalizeSdrSettings(patch.settings) }
        : {}),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapCampaign(data as Record<string, unknown>);
}

export async function renameSdrCampaign(id: string, name: string): Promise<SdrCampaign> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("El nombre de la campaña no puede estar vacío.");

  // Si está vinculada a Smartlead, renombra allí también (y persiste en CRM).
  const { data: current, error: loadError } = await supabase
    .from("sdr_campaigns")
    .select("outreach_provider, outreach_campaign_id")
    .eq("id", id)
    .maybeSingle();
  if (loadError) throw new Error(loadError.message);

  const outreachId = current?.outreach_campaign_id
    ? String(current.outreach_campaign_id).trim()
    : "";
  if (current?.outreach_provider === "smartlead" && outreachId) {
    const { data, error } = await supabase.functions.invoke("sdr-smartlead-provision", {
      body: {
        action: "rename",
        campaign_id: id,
        outreach_campaign_id: outreachId,
        name: trimmed,
      },
    });
    if (error || data?.error) throw new Error(await invokeErrorMessage(error, data));
    const { data: row, error: refetchError } = await supabase
      .from("sdr_campaigns")
      .select("*")
      .eq("id", id)
      .single();
    if (refetchError) throw new Error(refetchError.message);
    return mapCampaign(row as Record<string, unknown>);
  }

  const { data, error } = await supabase
    .from("sdr_campaigns")
    .update({ name: trimmed })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapCampaign(data as Record<string, unknown>);
}

/** Borra la campaña Astoha (leads + conversaciones en cascada). No borra la de Smartlead. */
export async function deleteSdrCampaign(id: string): Promise<void> {
  const { error } = await supabase.from("sdr_campaigns").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export type CrmLeadPick = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  empresa: string;
  cargo: string | null;
  fase: string;
  archived: boolean;
};

function crmSearchPattern(query: string): string | null {
  const cleaned = query.trim().replace(/[%_,.()"'\\]/g, " ").replace(/\s+/g, " ").trim();
  if (cleaned.length < 2) return null;
  return `%${cleaned}%`;
}

/** Busca en crm_leads para añadir uno a mano a la campaña. */
export async function searchCrmLeadsForSdr(query: string): Promise<CrmLeadPick[]> {
  const pattern = crmSearchPattern(query);
  if (!pattern) return [];
  const filter = ["nombre", "apellido", "empresa", "email"]
    .map((column) => `${column}.ilike."${pattern}"`)
    .join(",");
  const { data, error } = await supabase
    .from("crm_leads")
    .select("id, nombre, apellido, email, empresa, cargo, fase, archived")
    .or(filter)
    .limit(12);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as CrmLeadPick[];
  const rank = (lead: CrmLeadPick) =>
    (lead.fase === "perdido" ? 2 : 0) + (lead.archived ? 1 : 0);
  return rows.sort(
    (a, b) => rank(a) - rank(b) || a.empresa.localeCompare(b.empresa, "es"),
  );
}

/** Copia un lead del CRM a la campaña, en discovered, sin lanzar el envío. */
export async function addCrmLeadToSdrCampaign(
  campaignId: string,
  lead: CrmLeadPick,
): Promise<SdrLead> {
  const email = lead.email.trim().toLowerCase();
  if (!email.includes("@")) throw new Error("Este lead del CRM no tiene un email válido.");

  const { data: existing, error: existingError } = await supabase
    .from("sdr_leads")
    .select("id")
    .eq("campaign_id", campaignId)
    .ilike("email", email)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing?.id) throw new Error("Ese email ya está en esta campaña.");

  const { data, error } = await supabase
    .from("sdr_leads")
    .insert({
      campaign_id: campaignId,
      crm_lead_id: lead.id,
      first_name: lead.nombre.trim() || null,
      last_name: lead.apellido.trim() || null,
      email,
      company: lead.empresa.trim() || null,
      role: lead.cargo?.trim() || null,
      country: "Spain",
      language: "es",
      status: "discovered",
      consent_status: "legitimate_interest_b2b",
      metadata: { source: "crm", added_at: new Date().toISOString() },
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as SdrLead;
}

export async function listSdrLeads(campaignId: string): Promise<SdrLead[]> {
  const { data, error } = await supabase
    .from("sdr_leads")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as SdrLead[];
}

export async function updateSdrLeadLanguage(
  leadId: string,
  language: string,
): Promise<void> {
  const lang = language.trim().toLowerCase();
  if (!["es", "en", "de", "fr", "it"].includes(lang)) {
    throw new Error("Idioma no válido");
  }
  const { error } = await supabase
    .from("sdr_leads")
    .update({ language: lang })
    .eq("id", leadId);
  if (error) throw new Error(error.message);
}

export async function updateSdrLead(
  leadId: string,
  patch: Partial<Pick<
    SdrLead,
    | "first_name"
    | "last_name"
    | "email"
    | "company"
    | "role"
    | "country"
    | "language"
    | "industry"
    | "company_size"
    | "linkedin_url"
    | "status"
  >>,
): Promise<SdrLead> {
  const row: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    company?: string | null;
    role?: string | null;
    country?: string | null;
    language?: string;
    industry?: string | null;
    company_size?: string | null;
    linkedin_url?: string | null;
    status?: string;
  } = {};
  if (patch.first_name !== undefined) row.first_name = patch.first_name?.trim() || null;
  if (patch.last_name !== undefined) row.last_name = patch.last_name?.trim() || null;
  if (patch.email !== undefined) {
    const email = patch.email?.trim().toLowerCase() || null;
    if (email && !email.includes("@")) throw new Error("Email no válido");
    row.email = email;
  }
  if (patch.company !== undefined) row.company = patch.company?.trim() || null;
  if (patch.role !== undefined) row.role = patch.role?.trim() || null;
  if (patch.country !== undefined) row.country = patch.country?.trim() || null;
  if (patch.language !== undefined) {
    const lang = patch.language.trim().toLowerCase();
    if (!["es", "en", "de", "fr", "it"].includes(lang)) throw new Error("Idioma no válido");
    row.language = lang;
  }
  if (patch.industry !== undefined) row.industry = patch.industry?.trim() || null;
  if (patch.company_size !== undefined) row.company_size = patch.company_size?.trim() || null;
  if (patch.linkedin_url !== undefined) row.linkedin_url = patch.linkedin_url?.trim() || null;
  if (patch.status !== undefined) row.status = patch.status;

  const { data, error } = await supabase
    .from("sdr_leads")
    .update(row)
    .eq("id", leadId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as SdrLead;
}

export async function inferSdrLeadLocales(input: {
  campaign_id: string;
  lead_ids?: string[];
  only_missing?: boolean;
}): Promise<{ updated: number; scanned: number }> {
  const { data, error } = await supabase.functions.invoke("sdr-leads-infer-locale", {
    body: input,
  });
  if (error || data?.error) throw new Error(await invokeErrorMessage(error, data));
  return {
    updated: Number(data?.updated ?? 0),
    scanned: Number(data?.scanned ?? 0),
  };
}

export async function deleteSdrLeads(leadIds: string[]): Promise<number> {
  const ids = [...new Set(leadIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return 0;
  const { error, count } = await supabase
    .from("sdr_leads")
    .delete({ count: "exact" })
    .in("id", ids);
  if (error) throw new Error(error.message);
  return count ?? ids.length;
}

export async function listSdrConversations(
  leadId: string,
): Promise<SdrConversation[]> {
  const { data, error } = await supabase
    .from("sdr_conversations")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as SdrConversation[];
}

export async function fetchSdrMetrics(campaignId?: string | null): Promise<SdrMetrics> {
  const { data, error } = await supabase.rpc("sdr_campaign_metrics", {
    p_campaign_id: campaignId || null,
  });
  if (error) throw new Error(error.message);
  return asMetrics(data);
}

async function invokeErrorMessage(error: unknown, data: unknown): Promise<string> {
  if (data && typeof data === "object" && "error" in data && (data as { error?: unknown }).error) {
    return String((data as { error: unknown }).error);
  }
  const err = error as { message?: string; context?: Response } | null;
  if (err?.context && typeof err.context.json === "function") {
    try {
      const body = await err.context.json();
      if (body?.error) return String(body.error);
    } catch {
      /* ignore */
    }
  }
  return err?.message || "Edge Function error";
}

export async function enrichSdrLeads(input: {
  campaign_id: string;
  roles: string[];
  countries: string[];
  industries?: string[];
  company_sizes?: string[];
  limit?: number;
  exclude_domains?: string[];
  exclude_known_companies?: boolean;
}): Promise<{
  found: number;
  inserted: number;
  updated: number;
  no_email: number;
  skipped: number;
  excluded_domains: number;
}> {
  const { data, error } = await supabase.functions.invoke("sdr-enrich-leads", {
    body: input,
  });
  if (error || data?.error) throw new Error(await invokeErrorMessage(error, data));
  return {
    found: Number(data?.found ?? 0),
    inserted: Number(data?.inserted ?? 0),
    updated: Number(data?.updated ?? 0),
    no_email: Number(data?.no_email ?? 0),
    skipped: Number(data?.skipped ?? 0),
    excluded_domains: Number(data?.excluded_domains ?? 0),
  };
}

export async function launchSdrCampaign(input: {
  campaign_id: string;
  outreach_campaign_id?: string;
  outreach_provider?: string;
  agent_prompt?: string;
  calendly_url?: string;
  agent_language?: string;
  lead_ids?: string[];
  /** Re-lanzar contacted si el intento anterior dejó la campaña en borrador. */
  relaunch_contacted?: boolean;
  /** Ignora la cadencia ya guardada y reescribe los emails 1–3. */
  regenerate_copy?: boolean;
}): Promise<{
  launched: number;
  uploaded: number;
  updated: number;
  provider: string;
  smartlead_lead_count?: number | null;
  cadence?: string;
  remaining?: number;
  done?: boolean;
  start_warning?: string | null;
}> {
  const { data, error } = await supabase.functions.invoke("sdr-campaigns-launch", {
    body: input,
  });
  if (error || data?.error) throw new Error(await invokeErrorMessage(error, data));
  return {
    launched: Number(data?.launched ?? 0),
    uploaded: Number(data?.uploaded ?? data?.launched ?? 0),
    updated: Number(data?.updated ?? 0),
    provider: String(data?.provider ?? "smartlead"),
    smartlead_lead_count: data?.smartlead_lead_count != null
      ? Number(data.smartlead_lead_count)
      : null,
    cadence: data?.cadence != null ? String(data.cadence) : undefined,
    remaining: data?.remaining != null ? Number(data.remaining) : undefined,
    done: data?.done === true,
    start_warning: data?.start_warning != null ? String(data.start_warning) : null,
  };
}

export type SmartleadMailbox = {
  id: number;
  from_email: string;
  from_name: string | null;
  type: string | null;
  is_smtp_success: boolean | null;
  max_email_per_day: number | null;
};

export const EMPTY_SMARTLEAD_ANALYTICS: SmartleadCampaignAnalytics = {
  leads: 0,
  sent: 0,
  opened: 0,
  clicked: 0,
  replied: 0,
  replied_ooo: 0,
  positive: 0,
  bounced: 0,
  sender_bounced: 0,
};

function countField(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

export function parseSmartleadAnalytics(value: unknown): SmartleadCampaignAnalytics | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const m = value as Record<string, unknown>;
  return {
    leads: countField(m.leads),
    sent: countField(m.sent),
    opened: countField(m.opened),
    clicked: countField(m.clicked),
    replied: countField(m.replied),
    replied_ooo: countField(m.replied_ooo),
    positive: countField(m.positive),
    bounced: countField(m.bounced),
    sender_bounced: countField(m.sender_bounced),
  };
}

export function readCachedSmartleadAnalytics(
  metrics: Record<string, unknown> | null | undefined,
): SmartleadCampaignAnalytics | null {
  const sl = metrics?.smartlead;
  if (!sl || typeof sl !== "object" || Array.isArray(sl)) return null;
  return parseSmartleadAnalytics((sl as { analytics?: unknown }).analytics);
}

export type SmartleadCampaignStatus = {
  linked: boolean;
  outreach_campaign_id: string | null;
  smartlead_status: string | null;
  smartlead_name: string | null;
  sequences: number;
  lead_count: number | null;
  analytics: SmartleadCampaignAnalytics | null;
};

export async function fetchSmartleadCampaignStatus(input: {
  campaign_id: string;
  outreach_campaign_id?: string;
}): Promise<SmartleadCampaignStatus> {
  const { data, error } = await supabase.functions.invoke("sdr-smartlead-provision", {
    body: { action: "status", ...input },
  });
  if (error || data?.error) throw new Error(await invokeErrorMessage(error, data));
  return {
    linked: Boolean(data?.linked),
    outreach_campaign_id: data?.outreach_campaign_id != null
      ? String(data.outreach_campaign_id)
      : null,
    smartlead_status: data?.smartlead_status != null ? String(data.smartlead_status) : null,
    smartlead_name: data?.smartlead_name != null ? String(data.smartlead_name) : null,
    sequences: Number(data?.sequences ?? 0) || 0,
    lead_count: data?.lead_count != null ? Number(data.lead_count) : null,
    analytics: parseSmartleadAnalytics(data?.analytics),
  };
}

export async function listSmartleadMailboxes(): Promise<SmartleadMailbox[]> {
  const { data, error } = await supabase.functions.invoke("sdr-smartlead-provision", {
    body: { action: "list_accounts" },
  });
  if (error || data?.error) throw new Error(await invokeErrorMessage(error, data));
  const rows = Array.isArray(data?.accounts) ? data.accounts : [];
  return rows.map((r: Record<string, unknown>) => ({
    id: Number(r.id),
    from_email: String(r.from_email ?? ""),
    from_name: r.from_name != null ? String(r.from_name) : null,
    type: r.type != null ? String(r.type) : null,
    is_smtp_success: typeof r.is_smtp_success === "boolean" ? r.is_smtp_success : null,
    max_email_per_day: r.max_email_per_day != null ? Number(r.max_email_per_day) : null,
  }));
}

export async function provisionSmartleadCampaign(input: {
  campaign_id: string;
  email_account_id: number;
  name?: string;
  timezone?: string;
  outreach_campaign_id?: string;
  /** true = crea campaña nueva en Smartlead; false/omit = reutiliza la vinculada. */
  force_new?: boolean;
}): Promise<{
  outreach_campaign_id: string;
  email_account_id: number;
  webhook_id: string | null;
  reused: boolean;
}> {
  const { data, error } = await supabase.functions.invoke("sdr-smartlead-provision", {
    body: { action: "provision", ...input },
  });
  if (error || data?.error) throw new Error(await invokeErrorMessage(error, data));
  return {
    outreach_campaign_id: String(data?.outreach_campaign_id ?? ""),
    email_account_id: Number(data?.email_account_id ?? input.email_account_id),
    webhook_id: data?.webhook_id != null ? String(data.webhook_id) : null,
    reused: Boolean(data?.reused),
  };
}

/** Re-aplica secuencia día0/+3/+7 y schedule en la campaña Smartlead existente. */
export async function repairSmartleadSequence(input: {
  campaign_id: string;
  outreach_campaign_id?: string;
  email_account_id?: number;
  start?: boolean;
}): Promise<{ outreach_campaign_id: string; started: boolean }> {
  const { data, error } = await supabase.functions.invoke("sdr-smartlead-provision", {
    body: { action: "repair_sequence", ...input },
  });
  if (error || data?.error) throw new Error(await invokeErrorMessage(error, data));
  return {
    outreach_campaign_id: String(data?.outreach_campaign_id ?? ""),
    started: Boolean(data?.started),
  };
}

/** Repara configuración y saca la campaña de Draft (START). */
export async function startSmartleadCampaign(input: {
  campaign_id: string;
  outreach_campaign_id?: string;
  email_account_id?: number;
}): Promise<{ outreach_campaign_id: string; smartlead_status: string | null }> {
  const { data, error } = await supabase.functions.invoke("sdr-smartlead-provision", {
    body: { action: "start", ...input },
  });
  if (error || data?.error) throw new Error(await invokeErrorMessage(error, data));
  return {
    outreach_campaign_id: String(data?.outreach_campaign_id ?? ""),
    smartlead_status: data?.smartlead_status != null ? String(data.smartlead_status) : null,
  };
}
