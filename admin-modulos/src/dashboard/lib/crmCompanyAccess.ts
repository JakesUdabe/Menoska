import { supabase } from "@dashboard/integrations/supabase/client";
import { crmCompanyGroupKey } from "@dashboard/lib/crmCommercial";
import type { CrmLead } from "@dashboard/types/admin";

export type CrmCompanyLookup = {
  found: boolean;
  company_key: string;
  company_name: string;
  owner_id: string | null;
  owner_name: string | null;
  contact_count: number;
};

export type CrmCompanySearchRow = {
  company_key: string;
  company_name: string;
  domain: string | null;
  contact_count: number;
  owner_id: string | null;
  owner_name: string | null;
};

export type CrmCompanyRequest = {
  id: string;
  company_key: string;
  company_name: string;
  requester_id: string;
  status: "pending" | "approved" | "rejected";
  message: string | null;
  created_at: string;
  requester?: { full_name: string | null } | null;
};

export async function lookupCrmCompany(email: string, empresa: string): Promise<CrmCompanyLookup | null> {
  const { data, error } = await supabase.rpc("crm_company_lookup", {
    p_email: email.trim(),
    p_empresa: empresa.trim(),
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return row as CrmCompanyLookup;
}

export async function searchCompaniesForRequest(query: string): Promise<CrmCompanySearchRow[]> {
  const { data, error } = await supabase.rpc("crm_search_companies_for_request", {
    p_query: query.trim(),
  });
  if (error) throw error;
  return (data as CrmCompanySearchRow[]) ?? [];
}

export async function requestCompanyAccess(
  companyKey: string,
  companyName: string,
  message?: string,
): Promise<void> {
  const { error } = await supabase.rpc("crm_request_company", {
    p_company_key: companyKey,
    p_company_name: companyName,
    p_message: message || undefined,
  });
  if (error) throw error;
}

export async function assignCompanyToCommercial(companyKey: string, comercialId: string): Promise<number> {
  const { data, error } = await supabase.rpc("crm_assign_company_to_comercial", {
    p_company_key: companyKey,
    p_comercial_id: comercialId,
  });
  if (error) throw error;
  return typeof data === "number" ? data : 0;
}

export async function resolveCompanyRequest(requestId: string, approve: boolean): Promise<void> {
  const { error } = await supabase.rpc("crm_resolve_company_request", {
    p_request_id: requestId,
    p_approve: approve,
  });
  if (error) throw error;
}

export async function fetchPendingCompanyRequests(): Promise<CrmCompanyRequest[]> {
  const { data, error } = await supabase
    .from("crm_company_requests")
    .select("id, company_key, company_name, requester_id, status, message, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as CrmCompanyRequest[]) ?? [];
}

export async function fetchMyPendingRequestKeys(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("crm_company_requests")
    .select("company_key")
    .eq("requester_id", userId)
    .eq("status", "pending");
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.company_key));
}

export async function fetchCompanyCatalog(opts: {
  query?: string;
  limit?: number;
  offset?: number;
}): Promise<{ rows: CrmCompanySearchRow[]; total: number }> {
  const query = opts.query ?? "";
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;

  const listPromise = supabase.rpc("crm_list_companies_catalog", {
    p_query: query,
    p_limit: limit,
    p_offset: offset,
  });
  const countPromise = supabase.rpc("crm_count_companies_catalog", { p_query: query });
  const listRes = await listPromise;
  const countRes = await countPromise;

  if (listRes.error) throw listRes.error;
  if (countRes.error) throw countRes.error;

  return {
    rows: (listRes.data as CrmCompanySearchRow[] | null) ?? [],
    total: countRes.data ?? 0,
  };
}

/** Submit up to 10 company requests sharing one message. */
export async function requestCompaniesBatch(
  items: Array<{ company_key: string; company_name: string }>,
  message: string,
): Promise<{ sent: number; skipped: number }> {
  const batch = items.slice(0, 10);
  let sent = 0;
  let skipped = 0;
  for (const item of batch) {
    try {
      await requestCompanyAccess(item.company_key, item.company_name, message);
      sent += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("request_already_pending")) {
        skipped += 1;
      } else {
        throw err;
      }
    }
  }
  return { sent, skipped };
}

/** Loads pending-request metadata without breaking CRM if migration is missing. */
export async function loadCompanyRequestMeta(
  role: string | null | undefined,
  userId: string | undefined,
): Promise<{ requests: CrmCompanyRequest[]; pendingKeys: Set<string> }> {
  try {
    if (role === "admin") {
      return { requests: await fetchPendingCompanyRequests(), pendingKeys: new Set() };
    }
    if (userId) {
      return { requests: [], pendingKeys: await fetchMyPendingRequestKeys(userId) };
    }
  } catch {
    // Table/RPC not deployed yet — CRM still works.
  }
  return { requests: [], pendingKeys: new Set() };
}

/** Assign all leads in a company group (client-side, when RPC not needed). */
export function leadIdsForCompanyKey(allLeads: CrmLead[], companyKey: string): string[] {
  return allLeads
    .filter((l) => crmCompanyGroupKey(l) === companyKey)
    .map((l) => l.id);
}

export function userCanEmailLead(
  superAdmin: boolean,
  userId: string | undefined,
  lead: CrmLead | null,
): boolean {
  if (superAdmin) return true;
  if (!userId || !lead) return false;
  return (lead.comercial_id ?? "") === userId;
}
