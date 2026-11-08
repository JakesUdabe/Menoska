"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus, Pencil, Trash2, Loader2, Users, Trophy, AlertTriangle,
  ArrowUpDown, LayoutDashboard, ChevronLeft, ChevronRight, X, Search, Archive, GitBranch, Gift,
  Building2, Mail, Calendar, Handshake, Bot,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/browser";
import { useAuth } from "@/components/auth-provider";
import { isSuperAdmin } from "@/lib/admin/rbac";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useStaffProfiles } from "@/lib/admin/use-admin-data";
import { CrmPipelinePanel } from "@/components/admin/core/CrmPipelinePanel";
import { CrmLeadWorkbench } from "@/components/admin/core/CrmLeadWorkbench";
import type {
  CrmLead, CrmIncident, CrmPlatformClient, LeadPhase,
  IncidentPriority, IncidentStatus,
} from "@/lib/admin/types";
import { cn } from "@/lib/utils";
import {
  todayIso, contactUrgency, leadWasContacted, crmEmailDomain,
  isPublicCrmMailDomain, normalizeCrmCompany, resolveLeadCompanyTag,
  groupLeadsByCompany, type CrmCompanyGroup,
  type CommercialSender, DEFAULT_SENDER, userCanEmailLead,
} from "@/lib/admin/crm-commercial";

function normalizeCompanyCif(value: string): string | null {
  const cleaned = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return cleaned.length > 0 ? cleaned : null;
}

const PLAN_BADGE_COLORS: Record<string, string> = {
  starter: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
  business: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30",
  enterprise: "bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-500/30",
};

type SortKey = keyof Pick<CrmLead, "nombre" | "empresa" | "fase" | "ultimo_contacto" | "proximo_contacto">;

const PIPELINE_PHASES: LeadPhase[] = ["nuevo", "contactado", "propuesta", "negociacion", "perdido"];
const INCIDENT_STATUSES: IncidentStatus[] = ["abierta", "en_progreso", "resuelta", "cerrada"];
const INCIDENT_PRIORITIES: IncidentPriority[] = ["baja", "media", "alta", "critica"];
const LEADS_PAGE_SIZE = 50;
const COMPANIES_PAGE_SIZE = 50;
const LEADS_FETCH_PAGE = 1000;
type LeadsViewMode = "companies" | "contacts";

async function fetchAllCrmLeads(): Promise<CrmLead[]> {
  const rows: CrmLead[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("mc_crm_leads")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + LEADS_FETCH_PAGE - 1);
    if (error) throw error;
    const chunk = (data as CrmLead[]) ?? [];
    rows.push(...chunk);
    if (chunk.length < LEADS_FETCH_PAGE) break;
    from += LEADS_FETCH_PAGE;
  }
  return rows;
}

const PHASE_COLORS: Record<LeadPhase, string> = {
  nuevo: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
  contactado: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  propuesta: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
  negociacion: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30",
  convertido: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  perdido: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
};

const INCIDENT_PRIORITY_COLORS: Record<IncidentPriority, string> = {
  baja: "bg-slate-500/20",
  media: "bg-amber-500/20",
  alta: "bg-orange-500/20",
  critica: "bg-red-500/20",
};

export default function AdminCrmPage() {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const superAdmin = isSuperAdmin(profile?.role);
  const staff = useStaffProfiles();
  const commercialStaff = staff.filter((s) =>
    ["superadmin", "empleado"].includes(s.role),
  );

  const staffNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of commercialStaff) {
      map.set(s.user_id, s.full_name?.trim() || s.user_id.slice(0, 8));
    }
    return map;
  }, [commercialStaff]);

  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [incidents, setIncidents] = useState<CrmIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("empresa");
  const [sortAsc, setSortAsc] = useState(true);
  const [editLead, setEditLead] = useState<CrmLead | null>(null);
  const [showLeadSheet, setShowLeadSheet] = useState(false);
  const [crmTab, setCrmTab] = useState("leads");
  const [editIncident, setEditIncident] = useState<CrmIncident | null>(null);
  const [showIncidentDialog, setShowIncidentDialog] = useState(false);
  const [leadsPage, setLeadsPage] = useState(1);
  const [companiesPage, setCompaniesPage] = useState(1);
  const [leadsViewMode, setLeadsViewMode] = useState<LeadsViewMode>("companies");
  const [selectedCompanyKey, setSelectedCompanyKey] = useState<string | null>(null);
  const [filterComercial, setFilterComercial] = useState<string>("all");
  const [filterFase, setFilterFase] = useState<string>("all");
  const [pipelineOwnerId, setPipelineOwnerId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [senderId, setSenderId] = useState<string>("default");
  const [clientDomains, setClientDomains] = useState<Set<string>>(() => new Set());
  const [clientCompanies, setClientCompanies] = useState<Set<string>>(() => new Set());
  const [platformClients, setPlatformClients] = useState<CrmPlatformClient[]>([]);
  const [clientsSearch, setClientsSearch] = useState("");
  const [assignBusy, setAssignBusy] = useState(false);
  const [companyCifDraft, setCompanyCifDraft] = useState("");
  const [companyCifBusy, setCompanyCifBusy] = useState(false);

  const emDash = "—";
  const today = todayIso();

  const comercialLabel = useCallback((comercialId: string | null | undefined) => {
    if (!comercialId) return emDash;
    return staffNameById.get(comercialId) ?? comercialId.slice(0, 8);
  }, [emDash, staffNameById]);

  const planLabel = (planType: string | null | undefined) => {
    const plan = (planType || "starter").toLowerCase();
    if (plan === "enterprise") return "Enterprise";
    if (plan === "business") return "Business";
    return "Starter";
  };

  const senders = useMemo<CommercialSender[]>(() => {
    const fromStaff = commercialStaff
      .map((s) => {
        const email = (s.work_email ?? "").trim().toLowerCase();
        if (!email.includes("@")) return null;
        return {
          userId: s.user_id,
          fullName: s.full_name?.trim() || email,
          jobTitle: s.job_title?.trim() || "Equipo comercial",
          workEmail: email,
        } satisfies CommercialSender;
      })
      .filter((s): s is CommercialSender => s != null);
    return fromStaff.length > 0 ? fromStaff : [DEFAULT_SENDER];
  }, [commercialStaff]);

  useEffect(() => {
    if (!senders.some((s) => s.userId === senderId)) {
      setSenderId(senders[0]?.userId ?? "default");
    }
  }, [senders, senderId]);

  // CRM-only staff land on leads; keep them off superadmin-only tabs if role changes.
  useEffect(() => {
    if (superAdmin) return;
    const allowed = crmTab === "leads" || crmTab === "pipeline" || crmTab === "incidencias";
    if (!allowed) setCrmTab("leads");
  }, [superAdmin, crmTab]);

  // Employees always see their own pipeline; superadmin defaults to all.
  useEffect(() => {
    if (superAdmin) return;
    if (user?.id) setPipelineOwnerId(user.id);
  }, [superAdmin, user?.id]);

  const fetchData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const [allLeads, incRes, clientRes, platformRes] = await Promise.all([
        fetchAllCrmLeads(),
        supabase.from("mc_crm_incidents").select("*").order("fecha", { ascending: false }).limit(500),
        supabase.rpc("mc_crm_client_company_signals"),
        supabase.rpc("mc_list_platform_clients"),
      ]);
      if (incRes.error) throw incRes.error;
      if (platformRes.error) throw platformRes.error;
      setLeads(allLeads);
      setIncidents((incRes.data as CrmIncident[]) ?? []);
      setPlatformClients((platformRes.data as CrmPlatformClient[]) ?? []);

      const domains = new Set<string>();
      const companies = new Set<string>();
      if (!clientRes.error && Array.isArray(clientRes.data)) {
        for (const row of clientRes.data as Array<{ company_name: string | null; email_domain: string | null }>) {
          const company = normalizeCrmCompany(row.company_name);
          if (company) companies.add(company);
          const domain = (row.email_domain ?? "").trim().toLowerCase();
          if (domain && !isPublicCrmMailDomain(domain)) domains.add(domain);
        }
      }
      setClientDomains(domains);
      setClientCompanies(companies);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      const networkFail = /failed to fetch|networkerror|load failed|timed?\s*out/i.test(raw);
      toast.error(networkFail ? t("admin.crm.loadNetworkError") : (raw || t("admin.crm.loadError")));
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [t, profile?.role, user?.id]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const refreshCrmSilent = useCallback(async () => {
    await fetchData({ silent: true });
  }, [fetchData]);

  // Include archived contacted leads: replacing a contact must not erase company history.
  const contactedDomains = useMemo(() => {
    const domains = new Set<string>();
    for (const lead of leads) {
      if (!leadWasContacted(lead)) continue;
      const domain = crmEmailDomain(lead.email);
      if (domain && !isPublicCrmMailDomain(domain)) domains.add(domain);
    }
    return domains;
  }, [leads]);

  const contactedCompanies = useMemo(() => {
    const companies = new Set<string>();
    for (const lead of leads) {
      if (!leadWasContacted(lead)) continue;
      const company = normalizeCrmCompany(lead.empresa);
      if (company) companies.add(company);
    }
    return companies;
  }, [leads]);

  const directoryLeads = useMemo(
    () => leads.filter((l) => !l.is_converted && l.fase !== "convertido"),
    [leads],
  );

  const visibleDirectoryLeads = useMemo(() => {
    if (superAdmin) return directoryLeads;
    const uid = user?.id;
    if (!uid) return [];
    return directoryLeads.filter((l) => (l.comercial_id ?? "") === uid);
  }, [directoryLeads, superAdmin, user?.id]);
  const successLeads = useMemo(
    () => leads.filter((l) => l.is_converted || l.fase === "convertido"),
    [leads],
  );

  const filteredPlatformClients = useMemo(() => {
    const q = clientsSearch.trim().toLowerCase();
    if (!q) return platformClients;
    return platformClients.filter((c) => {
      const hay = `${c.full_name} ${c.company_name} ${c.email} ${c.plan_type}`.toLowerCase();
      return hay.includes(q);
    });
  }, [platformClients, clientsSearch]);

  const activeIncidents = useMemo(
    () => incidents.filter((i) => i.estado === "abierta" || i.estado === "en_progreso"),
    [incidents],
  );

  const sortedLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    const copy = visibleDirectoryLeads.filter((l) => {
      if (filterComercial !== "all" && (l.comercial_id ?? "") !== filterComercial) return false;
      if (filterFase !== "all" && l.fase !== filterFase) return false;
      if (q) {
        const hay = `${l.nombre} ${l.apellido} ${l.empresa} ${l.email} ${l.region ?? ""} ${l.gancho ?? ""} ${l.cargo ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    copy.sort((a, b) => {
      if (a.archived !== b.archived) return a.archived ? 1 : -1;
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = String(av).localeCompare(String(bv));
      return sortAsc ? cmp : -cmp;
    });
    return copy;
  }, [visibleDirectoryLeads, sortKey, sortAsc, filterComercial, filterFase, search]);

  const pipelineLeads = useMemo(() => {
    if (pipelineOwnerId === "all") return leads;
    return leads.filter((l) => (l.comercial_id ?? "") === pipelineOwnerId);
  }, [leads, pipelineOwnerId]);

  const leadsTotalPages = Math.max(1, Math.ceil(sortedLeads.length / LEADS_PAGE_SIZE));
  const safeLeadsPage = Math.min(leadsPage, leadsTotalPages);
  const paginatedLeads = useMemo(() => {
    const start = (safeLeadsPage - 1) * LEADS_PAGE_SIZE;
    return sortedLeads.slice(start, start + LEADS_PAGE_SIZE);
  }, [sortedLeads, safeLeadsPage]);

  const companyGroups = useMemo(
    () => groupLeadsByCompany(
      sortedLeads,
      contactedDomains,
      contactedCompanies,
      clientDomains,
      clientCompanies,
    ),
    [sortedLeads, contactedDomains, contactedCompanies, clientDomains, clientCompanies],
  );

  const companiesTotalPages = Math.max(1, Math.ceil(companyGroups.length / COMPANIES_PAGE_SIZE));
  const safeCompaniesPage = Math.min(companiesPage, companiesTotalPages);
  const paginatedCompanies = useMemo(() => {
    const start = (safeCompaniesPage - 1) * COMPANIES_PAGE_SIZE;
    return companyGroups.slice(start, start + COMPANIES_PAGE_SIZE);
  }, [companyGroups, safeCompaniesPage]);

  const selectedCompany = useMemo(
    () => (selectedCompanyKey
      ? companyGroups.find((g) => g.key === selectedCompanyKey) ?? null
      : null),
    [companyGroups, selectedCompanyKey],
  );

  useEffect(() => {
    setCompanyCifDraft(selectedCompany?.cif ?? "");
  }, [selectedCompany?.key, selectedCompany?.cif]);

  const hasLeadFilters = filterComercial !== "all" || filterFase !== "all" || search.trim() !== "";

  useEffect(() => {
    setLeadsPage(1);
    setCompaniesPage(1);
  }, [filterComercial, filterFase, search, sortKey, sortAsc]);

  useEffect(() => {
    if (leadsPage > leadsTotalPages) setLeadsPage(leadsTotalPages);
  }, [leadsPage, leadsTotalPages]);

  useEffect(() => {
    if (companiesPage > companiesTotalPages) setCompaniesPage(companiesTotalPages);
  }, [companiesPage, companiesTotalPages]);

  useEffect(() => {
    if (selectedCompanyKey && !companyGroups.some((g) => g.key === selectedCompanyKey)) {
      setSelectedCompanyKey(null);
    }
  }, [companyGroups, selectedCompanyKey]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(true); }
  };

  const openLead = (lead: CrmLead | null) => {
    setEditLead(lead);
    setShowLeadSheet(true);
  };

  const openCompany = (group: CrmCompanyGroup) => {
    setSelectedCompanyKey(group.key);
  };

  const closeCompany = () => setSelectedCompanyKey(null);

  const assignSelectedCompany = async (comercialId: string) => {
    if (!selectedCompany || !superAdmin || !comercialId) return;
    const ids = selectedCompany.contacts.map((c) => c.id);
    if (ids.length === 0) return;
    setAssignBusy(true);
    try {
      const { error } = await supabase
        .from("mc_crm_leads")
        .update({ comercial_id: comercialId })
        .in("id", ids);
      if (error) throw error;
      toast.success(t("admin.crm.companyAssigned", { count: ids.length }));
      await refreshCrmSilent();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.common.error"));
    } finally {
      setAssignBusy(false);
    }
  };

  const saveSelectedCompanyCif = async () => {
    if (!selectedCompany) return;
    const ids = selectedCompany.contacts.map((c) => c.id);
    if (ids.length === 0) return;
    const cif = normalizeCompanyCif(companyCifDraft);
    setCompanyCifBusy(true);
    try {
      const { error } = await supabase
        .from("mc_crm_leads")
        .update({ cif, updated_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
      setCompanyCifDraft(cif ?? "");
      toast.success(t("admin.crm.companyCifSaved", { count: ids.length }));
      await refreshCrmSilent();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.common.error"));
    } finally {
      setCompanyCifBusy(false);
    }
  };

  const renderCompanyTag = (tag: CrmCompanyGroup["tag"] | ReturnType<typeof resolveLeadCompanyTag>) => {
    if (tag === "client") {
      return (
        <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-medium border-red-500/40 text-red-700 dark:text-red-400 bg-red-500/10">
          {t("admin.crm.tagClientCompany")}
        </Badge>
      );
    }
    if (tag === "contacted") {
      return (
        <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal text-amber-800 dark:text-amber-300 border-amber-500/40 bg-amber-500/10">
          {t("admin.crm.tagContactedCompany")}
        </Badge>
      );
    }
    return null;
  };

  const deleteLead = async (id: string) => {
    const { error } = await supabase.from("mc_crm_leads").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(t("admin.common.deleted")); await fetchData(); }
  };

  const saveIncident = async (data: Partial<CrmIncident> & { id?: string }) => {
    try {
      if (data.id) {
        const { error } = await supabase.from("mc_crm_incidents").update({
          cliente: data.cliente,
          descripcion: data.descripcion,
          estado: data.estado,
          prioridad: data.prioridad,
          fecha: data.fecha,
        }).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("mc_crm_incidents").insert({
          cliente: data.cliente!,
          descripcion: data.descripcion!,
          estado: data.estado ?? "abierta",
          prioridad: data.prioridad ?? "media",
          fecha: data.fecha!,
          created_by: user?.id,
        });
        if (error) throw error;
      }
      toast.success(t("admin.crm.incidentSaved"));
      setShowIncidentDialog(false);
      setEditIncident(null);
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.common.error"));
    }
  };

  const deleteIncident = async (id: string) => {
    const { error } = await supabase.from("mc_crm_incidents").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(t("admin.common.deletedFemale")); await fetchData(); }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const pipelineFocused = crmTab === "pipeline";
  const chromeHidden = pipelineFocused;

  return (
    <div className={cn("space-y-8", chromeHidden && "space-y-4 w-full min-w-0")}>
      {!chromeHidden && (
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">{t("admin.crm.title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("admin.crm.subtitle")}</p>
        </div>
      )}

      <Tabs value={crmTab} onValueChange={setCrmTab} className={cn(chromeHidden && "w-full min-w-0")}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="leads" className="gap-2">
            <Users className="w-4 h-4" /> {t("admin.crm.tabLeads", { count: visibleDirectoryLeads.length })}
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="gap-2">
            <GitBranch className="w-4 h-4" /> {t("admin.crm.tabPipeline")}
          </TabsTrigger>
          <TabsTrigger value="incidencias" className="gap-2">
            <AlertTriangle className="w-4 h-4" /> {t("admin.crm.tabIncidents", { count: activeIncidents.length })}
          </TabsTrigger>
          {superAdmin && (
            <TabsTrigger value="exito" className="gap-2">
              <Trophy className="w-4 h-4" /> {t("admin.crm.tabSuccess", { count: platformClients.length })}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="leads" className="mt-4 space-y-4">
          {selectedCompany ? (
            <Card className="min-h-[70vh] border-primary/20">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between space-y-0">
                <div className="space-y-1 min-w-0">
                  <Button type="button" variant="ghost" size="sm" className="-ml-2 gap-1" onClick={closeCompany}>
                    <ChevronLeft className="w-4 h-4" />
                    {t("admin.crm.backToCompanies")}
                  </Button>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Building2 className="w-5 h-5 text-primary shrink-0" />
                    <span className="truncate">{selectedCompany.companyName}</span>
                  </CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-2">
                    {selectedCompany.domain && (
                      <span className="font-mono text-xs">{selectedCompany.domain}</span>
                    )}
                    <span>{t("admin.crm.companyContactsCount", { count: selectedCompany.contactCount })}</span>
                    {renderCompanyTag(selectedCompany.tag)}
                    <Badge variant="outline">
                      {t("admin.crm.commercial")}: {comercialLabel(selectedCompany.comercialId)}
                    </Badge>
                  </CardDescription>
                </div>
                <div className="flex flex-col gap-2 shrink-0 sm:items-end">
                  <div className="flex flex-col gap-1.5 w-full sm:w-[260px]">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                      {t("admin.crm.cif")}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={companyCifDraft}
                        onChange={(e) => setCompanyCifDraft(e.target.value)}
                        placeholder="B12345678"
                        autoComplete="off"
                        className="font-mono uppercase"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={companyCifBusy
                          || normalizeCompanyCif(companyCifDraft) === (selectedCompany.cif ?? null)}
                        onClick={() => void saveSelectedCompanyCif()}
                      >
                        {companyCifBusy
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : t("admin.common.save")}
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{t("admin.crm.companyCifHint")}</p>
                  </div>
                  {superAdmin && (
                    <div className="flex flex-col gap-1.5 w-full sm:w-[220px]">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                        {t("admin.crm.assignCompanyCommercial")}
                      </Label>
                      <Select
                        value={selectedCompany.comercialId ?? ""}
                        onValueChange={(v) => void assignSelectedCompany(v)}
                        disabled={assignBusy}
                      >
                        <SelectTrigger><SelectValue placeholder={t("admin.crm.filterAllCommercials")} /></SelectTrigger>
                        <SelectContent>
                          {commercialStaff.map((s) => (
                            <SelectItem key={s.user_id} value={s.user_id}>
                              {s.full_name ?? s.user_id.slice(0, 8)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <Button size="sm" className="gap-1" onClick={() => openLead(null)}>
                    <Plus className="w-4 h-4" /> {t("admin.crm.newLead")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("admin.crm.colName")}</TableHead>
                        <TableHead>{t("admin.crm.roleTitle")}</TableHead>
                        <TableHead>{t("admin.crm.commercial")}</TableHead>
                        <TableHead>{t("admin.crm.colEmail")}</TableHead>
                        <TableHead>{t("admin.crm.colPhase")}</TableHead>
                        <TableHead>{t("admin.crm.colNextContact")}</TableHead>
                        <TableHead className="w-[80px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedCompany.contacts.map((lead) => (
                        <TableRow key={lead.id} className="cursor-pointer" onClick={() => openLead(lead)}>
                          <TableCell className="font-medium">
                            {[lead.nombre, lead.apellido].filter(Boolean).join(" ") || emDash}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{lead.cargo || emDash}</TableCell>
                          <TableCell className="text-sm">{comercialLabel(lead.comercial_id)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {lead.email || emDash}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={PHASE_COLORS[lead.fase]}>
                              {t(`admin.leadPhases.${lead.fase}`)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {lead.fase !== "perdido" && lead.fase !== "convertido" && lead.proximo_contacto ? (
                              <span className={cn(
                                "flex items-center gap-1",
                                contactUrgency(lead.proximo_contacto, today) === "overdue" && "text-red-600",
                                contactUrgency(lead.proximo_contacto, today) === "soon" && "text-emerald-600",
                              )}>
                                <Calendar className="w-3 h-3" />{lead.proximo_contacto}
                              </span>
                            ) : emDash}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" onClick={() => openLead(lead)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              {superAdmin && (
                                <Button variant="ghost" size="icon" onClick={() => deleteLead(lead.id)}>
                                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0">
                <CardTitle>{t("admin.crm.leadsTitle")}</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-md border border-border p-0.5 bg-muted/40">
                    <Button
                      type="button"
                      size="sm"
                      variant={leadsViewMode === "companies" ? "secondary" : "ghost"}
                      className="h-8 gap-1"
                      onClick={() => setLeadsViewMode("companies")}
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      {t("admin.crm.viewByCompany")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={leadsViewMode === "contacts" ? "secondary" : "ghost"}
                      className="h-8 gap-1"
                      onClick={() => setLeadsViewMode("contacts")}
                    >
                      <Users className="w-3.5 h-3.5" />
                      {t("admin.crm.viewByContact")}
                    </Button>
                  </div>
                  <Button size="sm" className="gap-1" onClick={() => openLead(null)}>
                    <Plus className="w-4 h-4" /> {t("admin.crm.newLead")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.crm.search")}</Label>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                      <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("admin.crm.searchPlaceholder")} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.crm.filterByCommercial")}</Label>
                    <Select value={filterComercial} onValueChange={setFilterComercial}>
                      <SelectTrigger><SelectValue placeholder={t("admin.crm.filterAllCommercials")} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("admin.crm.filterAllCommercials")}</SelectItem>
                        {commercialStaff.map((s) => (
                          <SelectItem key={s.user_id} value={s.user_id}>
                            {s.full_name ?? s.user_id.slice(0, 8)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.crm.filterByPhase")}</Label>
                    <Select value={filterFase} onValueChange={setFilterFase}>
                      <SelectTrigger><SelectValue placeholder={t("admin.crm.filterAllPhases")} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("admin.crm.filterAllPhases")}</SelectItem>
                        {PIPELINE_PHASES.map((phase) => (
                          <SelectItem key={phase} value={phase}>{t(`admin.leadPhases.${phase}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {hasLeadFilters && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mb-4"
                    onClick={() => {
                      setFilterComercial("all");
                      setFilterFase("all");
                      setSearch("");
                    }}
                  >
                    <X className="w-4 h-4 mr-1" />
                    {t("admin.crm.clearFilters")}
                  </Button>
                )}

                {leadsViewMode === "companies" ? (
                  companyGroups.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">
                      {hasLeadFilters ? t("admin.crm.noFilterResults") : t("admin.crm.noActiveLeads")}
                    </p>
                  ) : (
                    <div className="rounded-md border overflow-hidden">
                      <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border bg-muted/30">
                        {hasLeadFilters
                          ? t("admin.crm.showingCompaniesFiltered", {
                            filtered: companyGroups.length,
                            contacts: sortedLeads.length,
                            total: visibleDirectoryLeads.length,
                          })
                          : t("admin.crm.companiesTotal", {
                            companies: companyGroups.length,
                            contacts: sortedLeads.length,
                            pageSize: COMPANIES_PAGE_SIZE,
                          })}
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("admin.crm.colCompany")}</TableHead>
                            <TableHead>{t("admin.crm.commercial")}</TableHead>
                            <TableHead>{t("admin.crm.colDomain")}</TableHead>
                            <TableHead>{t("admin.crm.colContacts")}</TableHead>
                            <TableHead>{t("admin.crm.colNextContact")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedCompanies.map((group) => (
                            <TableRow
                              key={group.key}
                              className="cursor-pointer"
                              onClick={() => openCompany(group)}
                            >
                              <TableCell>
                                <span className="flex items-center gap-1 text-sm font-medium">
                                  <Building2 className="w-3 h-3 text-muted-foreground" />
                                  {group.companyName}
                                </span>
                                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                  {renderCompanyTag(group.tag)}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">
                                {comercialLabel(group.comercialId)}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground font-mono">
                                {group.domain || emDash}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="tabular-nums">
                                  {group.contactCount}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">
                                {group.nextContact ? (
                                  <span className={cn(
                                    "flex items-center gap-1",
                                    contactUrgency(group.nextContact, today) === "overdue" && "text-red-600",
                                    contactUrgency(group.nextContact, today) === "soon" && "text-emerald-600",
                                  )}>
                                    <Calendar className="w-3 h-3" />{group.nextContact}
                                  </span>
                                ) : emDash}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {companiesTotalPages > 1 && (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-t border-border bg-muted/20">
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {t("admin.crm.page", { current: safeCompaniesPage, total: companiesTotalPages })}
                          </span>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setCompaniesPage(Math.max(1, safeCompaniesPage - 1))} disabled={safeCompaniesPage === 1}>
                              <ChevronLeft className="w-4 h-4 mr-1" />{t("admin.crm.previous")}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setCompaniesPage(Math.min(companiesTotalPages, safeCompaniesPage + 1))} disabled={safeCompaniesPage === companiesTotalPages}>
                              {t("admin.crm.next")}<ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                ) : sortedLeads.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-10">
                    {hasLeadFilters ? t("admin.crm.noFilterResults") : t("admin.crm.noActiveLeads")}
                  </p>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border bg-muted/30">
                      {hasLeadFilters
                        ? t("admin.crm.showingCount", { filtered: sortedLeads.length, total: visibleDirectoryLeads.length })
                        : t("admin.crm.tableTotal", { total: sortedLeads.length, pageSize: LEADS_PAGE_SIZE })}
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <SortHead label={t("admin.crm.colCompany")} sortKey="empresa" current={sortKey} asc={sortAsc} onSort={toggleSort} />
                          <TableHead>{t("admin.crm.commercial")}</TableHead>
                          <TableHead>{t("admin.crm.roleTitle")}</TableHead>
                          <TableHead>{t("admin.crm.colEmail")}</TableHead>
                          <SortHead label={t("admin.crm.colPhase")} sortKey="fase" current={sortKey} asc={sortAsc} onSort={toggleSort} />
                          <SortHead label={t("admin.crm.colNextContact")} sortKey="proximo_contacto" current={sortKey} asc={sortAsc} onSort={toggleSort} />
                          <TableHead className="w-[80px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedLeads.map((lead) => (
                          <TableRow key={lead.id} className="cursor-pointer" onClick={() => openLead(lead)}>
                            <TableCell>
                              <span className="flex items-center gap-1 text-sm font-medium">
                                <Building2 className="w-3 h-3 text-muted-foreground" />{lead.empresa}
                              </span>
                              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                {renderCompanyTag(resolveLeadCompanyTag(
                                  lead,
                                  contactedDomains,
                                  contactedCompanies,
                                  clientDomains,
                                  clientCompanies,
                                ))}
                                {lead.archived && (
                                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal gap-1 text-muted-foreground">
                                    <Archive className="w-2.5 h-2.5" />
                                    {t("admin.crm.originArchive")}
                                  </Badge>
                                )}
                                {lead.region && <p className="text-[11px] text-muted-foreground">{lead.region}</p>}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{comercialLabel(lead.comercial_id)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{lead.cargo || emDash}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {lead.email || emDash}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={PHASE_COLORS[lead.fase]}>
                                {t(`admin.leadPhases.${lead.fase}`)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {lead.fase !== "perdido" && lead.fase !== "convertido" && lead.proximo_contacto ? (
                                <span className={cn(
                                  "flex items-center gap-1",
                                  contactUrgency(lead.proximo_contacto, today) === "overdue" && "text-red-600",
                                  contactUrgency(lead.proximo_contacto, today) === "soon" && "text-emerald-600",
                                )}>
                                  <Calendar className="w-3 h-3" />{lead.proximo_contacto}
                                </span>
                              ) : emDash}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" onClick={() => openLead(lead)}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                {superAdmin && (
                                  <Button variant="ghost" size="icon" onClick={() => deleteLead(lead.id)}>
                                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {leadsTotalPages > 1 && (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-t border-border bg-muted/20">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {t("admin.crm.page", { current: safeLeadsPage, total: leadsTotalPages })}
                        </span>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setLeadsPage(Math.max(1, safeLeadsPage - 1))} disabled={safeLeadsPage === 1}>
                            <ChevronLeft className="w-4 h-4 mr-1" />{t("admin.crm.previous")}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setLeadsPage(Math.min(leadsTotalPages, safeLeadsPage + 1))} disabled={safeLeadsPage === leadsTotalPages}>
                            {t("admin.crm.next")}<ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="pipeline" className="mt-3 w-full min-w-0 focus-visible:outline-none">
          <CrmPipelinePanel
            leads={pipelineLeads}
            onRefresh={refreshCrmSilent}
            onOpenLead={openLead}
            isSuperAdmin={superAdmin}
            commercialStaff={commercialStaff.map((s) => ({
              user_id: s.user_id,
              full_name: s.full_name,
            }))}
            pipelineOwnerId={pipelineOwnerId}
            onPipelineOwnerChange={setPipelineOwnerId}
            canAccessEmail={superAdmin || !!user?.id}
          />
        </TabsContent>

        {superAdmin && (
          <>
        <TabsContent value="exito" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("admin.crm.successTitle")}</CardTitle>
              <CardDescription>{t("admin.crm.successDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 max-w-sm space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.crm.search")}</Label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    value={clientsSearch}
                    onChange={(e) => setClientsSearch(e.target.value)}
                    placeholder={t("admin.crm.clientsSearchPlaceholder")}
                  />
                </div>
              </div>

              {platformClients.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">{t("admin.crm.noSuccess")}</p>
              ) : filteredPlatformClients.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">{t("admin.crm.noFilterResults")}</p>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border bg-muted/30">
                    {clientsSearch.trim()
                      ? t("admin.crm.showingCount", { filtered: filteredPlatformClients.length, total: platformClients.length })
                      : t("admin.crm.clientsTotal", { total: platformClients.length })}
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("admin.crm.colName")}</TableHead>
                        <TableHead>{t("admin.crm.colCompany")}</TableHead>
                        <TableHead>{t("admin.crm.colEmail")}</TableHead>
                        <TableHead>{t("admin.crm.colPlan")}</TableHead>
                        <TableHead>{t("admin.crm.colRegistered")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPlatformClients.map((client) => {
                        const plan = (client.plan_type || "starter").toLowerCase();
                        return (
                          <TableRow key={client.user_id}>
                            <TableCell className="font-medium">
                              {client.full_name?.trim() || emDash}
                            </TableCell>
                            <TableCell>
                              <span className="flex items-center gap-1 text-sm">
                                <Building2 className="w-3 h-3 text-muted-foreground shrink-0" />
                                {client.company_name?.trim() || emDash}
                              </span>
                            </TableCell>
                            <TableCell>
                              {client.email ? (
                                <a href={`mailto:${client.email}`} className="flex items-center gap-1 text-primary hover:underline text-sm">
                                  <Mail className="w-3 h-3" />{client.email}
                                </a>
                              ) : emDash}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={PLAN_BADGE_COLORS[plan] ?? PLAN_BADGE_COLORS.starter}>
                                {planLabel(plan)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground tabular-nums">
                              {client.created_at
                                ? new Date(client.created_at).toLocaleDateString()
                                : emDash}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {successLeads.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("admin.crm.convertedLeadsTitle")}</CardTitle>
                <CardDescription>{t("admin.crm.convertedLeadsDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {successLeads.map((lead) => (
                    <Card key={lead.id} className="border-emerald-500/20 bg-emerald-500/5 cursor-pointer" onClick={() => openLead(lead)}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold">{lead.empresa}</p>
                            <p className="text-sm text-muted-foreground">{lead.nombre} {lead.apellido}</p>
                            <p className="text-xs text-primary mt-1">{lead.email}</p>
                          </div>
                          <Trophy className="w-5 h-5 text-emerald-500" />
                        </div>
                        {lead.comentarios && (
                          <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{lead.comentarios}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
          </>
        )}

        <TabsContent value="incidencias" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t("admin.crm.incidentsTitle")}</CardTitle>
                <CardDescription>{t("admin.crm.incidentsDesc")}</CardDescription>
              </div>
              <Button size="sm" className="gap-1" onClick={() => { setEditIncident(null); setShowIncidentDialog(true); }}>
                <Plus className="w-4 h-4" /> {t("admin.crm.newIncident")}
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.crm.colId")}</TableHead>
                    <TableHead>{t("admin.crm.colClient")}</TableHead>
                    <TableHead>{t("admin.crm.colDescription")}</TableHead>
                    <TableHead>{t("admin.crm.colStatus")}</TableHead>
                    <TableHead>{t("admin.crm.colPriority")}</TableHead>
                    <TableHead>{t("admin.crm.colDate")}</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incidents.map((inc) => (
                    <TableRow key={inc.id}>
                      <TableCell className="font-mono text-xs">{inc.id.slice(0, 8)}</TableCell>
                      <TableCell className="font-medium">{inc.cliente}</TableCell>
                      <TableCell className="max-w-[250px] truncate">{inc.descripcion}</TableCell>
                      <TableCell><Badge variant="secondary">{t(`admin.incidentStatuses.${inc.estado}`)}</Badge></TableCell>
                      <TableCell>
                        <Badge className={INCIDENT_PRIORITY_COLORS[inc.prioridad]}>{t(`admin.incidentPriorities.${inc.prioridad}`)}</Badge>
                      </TableCell>
                      <TableCell>{inc.fecha}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => { setEditIncident(inc); setShowIncidentDialog(true); }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteIncident(inc.id)}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      <CrmLeadWorkbench
        lead={editLead}
        commercialStaff={commercialStaff}
        senders={senders}
        open={showLeadSheet}
        onClose={() => { setShowLeadSheet(false); setEditLead(null); }}
        onSaved={refreshCrmSilent}
        canAccessEmail={
          userCanEmailLead(superAdmin, user?.id, editLead)
          || (!editLead && !superAdmin && !!user?.id)
        }
        currentUserId={user?.id}
        isSuperAdmin={superAdmin}
        companyDefaults={selectedCompany
          ? { empresa: selectedCompany.companyName, cif: selectedCompany.cif }
          : null}
      />
      {showIncidentDialog && (
        <IncidentDialog
          incident={editIncident}
          onClose={() => { setShowIncidentDialog(false); setEditIncident(null); }}
          onSave={saveIncident}
        />
      )}
    </div>
  );
}

function SortHead({
  label, sortKey, current, asc, onSort,
}: {
  label: string; sortKey: SortKey; current: SortKey; asc: boolean;
  onSort: (k: SortKey) => void;
}) {
  return (
    <TableHead>
      <button
        type="button"
        className="flex items-center gap-1 hover:text-foreground transition-colors"
        onClick={() => onSort(sortKey)}
      >
        {label}
        <ArrowUpDown className={cn("w-3 h-3", current === sortKey && "text-primary")} />
        {current === sortKey && (asc ? " ↑" : " ↓")}
      </button>
    </TableHead>
  );
}

function IncidentDialog({
  incident, onClose, onSave,
}: {
  incident: CrmIncident | null;
  onClose: () => void;
  onSave: (data: Partial<CrmIncident> & { id?: string }) => void;
}) {
  const { t } = useTranslation();
  const [cliente, setCliente] = useState(incident?.cliente ?? "");
  const [descripcion, setDescripcion] = useState(incident?.descripcion ?? "");
  const [estado, setEstado] = useState<IncidentStatus>(incident?.estado ?? "abierta");
  const [prioridad, setPrioridad] = useState<IncidentPriority>(incident?.prioridad ?? "media");
  const [fecha, setFecha] = useState(incident?.fecha ?? new Date().toISOString().slice(0, 10));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{incident ? t("admin.crm.editIncident") : t("admin.crm.newIncident")}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>{t("admin.common.client")}</Label><Input value={cliente} onChange={(e) => setCliente(e.target.value)} /></div>
          <div><Label>{t("admin.common.description")}</Label><Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t("admin.common.status")}</Label>
              <Select value={estado} onValueChange={(v) => setEstado(v as IncidentStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INCIDENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{t(`admin.incidentStatuses.${s}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("admin.common.priority")}</Label>
              <Select value={prioridad} onValueChange={(v) => setPrioridad(v as IncidentPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INCIDENT_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>{t(`admin.incidentPriorities.${p}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>{t("admin.common.date")}</Label><Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("admin.common.cancel")}</Button>
          <Button onClick={() => onSave({
            id: incident?.id, cliente, descripcion, estado, prioridad, fecha,
          })}>{t("admin.common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
