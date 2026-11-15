import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot, Loader2, Mail, MessageSquare, Pencil, Plus, Rocket, Search, Sparkles, Target, Trash2, Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Badge } from "@/dashboard/components/ui/badge";
import { Button } from "@/dashboard/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/dashboard/components/ui/card";
import { Input } from "@/dashboard/components/ui/input";
import { Label } from "@/dashboard/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/dashboard/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/dashboard/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/dashboard/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/dashboard/components/ui/dialog";
import { Textarea } from "@/dashboard/components/ui/textarea";
import { cn } from "@/dashboard/lib/utils";
import {
  addCrmLeadToSdrCampaign,
  createSdrCampaign,
  deleteSdrCampaign,
  deleteSdrLeads,
  enrichSdrLeads,
  EMPTY_SMARTLEAD_ANALYTICS,
  fetchSdrMetrics,
  fetchSmartleadCampaignStatus,
  readCachedSmartleadAnalytics,
  inferSdrLeadLocales,
  launchSdrCampaign,
  listSdrCampaigns,
  searchCrmLeadsForSdr,
  listSdrConversations,
  listSdrLeads,
  listSmartleadMailboxes,
  provisionSmartleadCampaign,
  renameSdrCampaign,
  repairSmartleadSequence,
  startSmartleadCampaign,
  updateSdrCampaign,
  updateSdrLead,
  updateSdrLeadLanguage,
  type CrmLeadPick,
  type SmartleadCampaignStatus,
  type SmartleadMailbox,
} from "./api";
import { Checkbox } from "@/dashboard/components/ui/checkbox";
import { useStaffProfiles } from "@/dashboard/hooks/useAdminData";
import type {
  SdrCampaign,
  SdrCampaignSettings,
  SdrConversation,
  SdrLead,
  SdrLeadStatus,
  SdrMetrics,
  SmartleadCampaignAnalytics,
} from "./types";
import {
  DEFAULT_SDR_COMPANY_SIZES,
  DEFAULT_SDR_COUNTRIES,
  DEFAULT_SDR_EXCLUDE_DOMAINS,
  DEFAULT_SDR_PROMPT,
  DEFAULT_SDR_ROLES,
  DEFAULT_SDR_SETTINGS,
  normalizeSdrSettings,
} from "./types";

/** ADAPT: dominios de correo de ESTA marca (prioridad al elegir buzón Smartlead). */
const BRAND_MAIL_DOMAINS = ["example.com"];

function isBrandMailbox(email: string): boolean {
  const lower = email.toLowerCase();
  return BRAND_MAIL_DOMAINS.some((d) => lower.endsWith(`@${d.toLowerCase()}`));
}

const WEEKDAY_KEYS = [
  { value: 1, labelKey: "weekdayMon" },
  { value: 2, labelKey: "weekdayTue" },
  { value: 3, labelKey: "weekdayWed" },
  { value: 4, labelKey: "weekdayThu" },
  { value: 5, labelKey: "weekdayFri" },
  { value: 6, labelKey: "weekdaySat" },
  { value: 0, labelKey: "weekdaySun" },
] as const;

const STATUS_COLORS: Record<SdrLeadStatus, string> = {
  discovered: "bg-slate-500/15 text-slate-700 border-slate-500/30",
  queued: "bg-sky-500/15 text-sky-800 border-sky-500/30",
  contacted: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  replied: "bg-violet-500/15 text-violet-700 border-violet-500/30",
  demo_requested: "bg-amber-500/15 text-amber-800 border-amber-500/30",
  demo_scheduled: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  unsubscribed: "bg-red-500/15 text-red-700 border-red-500/30",
  bounced: "bg-orange-500/15 text-orange-800 border-orange-500/30",
  lost: "bg-zinc-500/15 text-zinc-700 border-zinc-500/30",
};

function smartleadStatusClass(status: string | null | undefined): string {
  const s = (status || "").toUpperCase();
  if (s === "ACTIVE" || s === "START") {
    return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
  }
  if (s === "PAUSED" || s === "PAUSE") {
    return "bg-amber-500/15 text-amber-800 border-amber-500/30";
  }
  if (s === "STOPPED" || s === "STOP") {
    return "bg-red-500/15 text-red-700 border-red-500/30";
  }
  if (s === "DRAFTED" || s === "DRAFT") {
    return "bg-slate-500/15 text-slate-700 border-slate-500/30";
  }
  if (s === "COMPLETED" || s === "ARCHIVED") {
    return "bg-zinc-500/15 text-zinc-700 border-zinc-500/30";
  }
  return "bg-muted text-muted-foreground border-border";
}

function smartleadStatusLabel(status: string | null | undefined, t: (k: string) => string): string {
  const s = (status || "").toUpperCase();
  if (s === "ACTIVE" || s === "START") return t("admin.crm.sdr.smartleadStatus.active");
  if (s === "PAUSED" || s === "PAUSE") return t("admin.crm.sdr.smartleadStatus.paused");
  if (s === "STOPPED" || s === "STOP") return t("admin.crm.sdr.smartleadStatus.stopped");
  if (s === "DRAFTED" || s === "DRAFT") return t("admin.crm.sdr.smartleadStatus.drafted");
  if (s === "COMPLETED") return t("admin.crm.sdr.smartleadStatus.completed");
  if (s === "ARCHIVED") return t("admin.crm.sdr.smartleadStatus.archived");
  return status?.trim() || t("admin.crm.sdr.smartleadStatus.unknown");
}

function csv(value: string): string[] {
  return value.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
}

/** Apollo employee ranges keep an internal comma ("51,200"); split only on ; or newlines. */
function apolloEmployeeRanges(value: string): string[] {
  return value
    .split(/[;\n]+/)
    .map((s) => s.trim())
    .filter((s) => /^\d+,\d+$/.test(s) || /^\d+,$/.test(s));
}

function joinCsv(values: string[] | null | undefined): string {
  return (values ?? []).join(", ");
}

function joinApolloRanges(values: string[] | null | undefined): string {
  const list = values ?? [];
  if (list.length === 0) return "";
  // Repair previously saved broken splits: ["51","200","201","500"] → "51,200; 201,500"
  if (list.every((v) => /^\d+$/.test(v)) && list.length % 2 === 0) {
    const paired: string[] = [];
    for (let i = 0; i < list.length; i += 2) {
      paired.push(`${list[i]},${list[i + 1]}`);
    }
    return paired.join("; ");
  }
  return list.join("; ");
}

const MANUAL_TOKENS = [
  { id: "nombre", token: "{{nombre}}" },
  { id: "apellido", token: "{{apellido}}" },
  { id: "empresa", token: "{{empresa}}" },
  { id: "cargo", token: "{{cargo}}" },
  { id: "industria", token: "{{industria}}" },
  { id: "pais", token: "{{pais}}" },
  { id: "email", token: "{{email}}" },
  { id: "tamano", token: "{{tamano}}" },
] as const;

function missingManualStep(settings: SdrCampaignSettings): number | null {
  if (settings.copy_mode !== "manual") return null;
  const blank = (subject: string, body: string) => !subject.trim() || !body.trim();
  if (blank(settings.manual_step1_subject, settings.manual_step1_body)) return 1;
  if (settings.enable_followup && blank(settings.manual_step2_subject, settings.manual_step2_body)) return 2;
  if (settings.enable_reminder && blank(settings.manual_step3_subject, settings.manual_step3_body)) return 3;
  return null;
}

function insertAtCursor(
  el: HTMLInputElement | HTMLTextAreaElement | null,
  value: string,
  token: string,
  apply: (next: string) => void,
) {
  if (!el) {
    apply(`${value}${token}`);
    return;
  }
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  apply(`${value.slice(0, start)}${token}${value.slice(end)}`);
  const pos = start + token.length;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  });
}

function ManualStepEditor({
  step,
  subject,
  body,
  enabled,
  onSubject,
  onBody,
}: {
  step: 1 | 2 | 3;
  subject: string;
  body: string;
  enabled: boolean;
  onSubject: (value: string) => void;
  onBody: (value: string) => void;
}) {
  const { t } = useTranslation();
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const focusTarget = useRef<"subject" | "body">("body");

  const insert = (token: string) => {
    if (focusTarget.current === "subject") {
      insertAtCursor(subjectRef.current, subject, token, onSubject);
    } else {
      insertAtCursor(bodyRef.current, body, token, onBody);
    }
  };

  return (
    <div className={cn("space-y-2 rounded-md border border-border/70 p-3", !enabled && "opacity-70")}>
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">{t(`admin.crm.sdr.manualEmail${step}`)}</Label>
        {!enabled ? (
          <span className="text-[11px] text-muted-foreground">{t("admin.crm.sdr.manualStepOff")}</span>
        ) : null}
      </div>
      <Input
        ref={subjectRef}
        value={subject}
        placeholder={t("admin.crm.sdr.manualSubject")}
        onFocus={() => {
          focusTarget.current = "subject";
        }}
        onChange={(e) => onSubject(e.target.value)}
      />
      <Textarea
        ref={bodyRef}
        className="min-h-[180px] text-sm"
        value={body}
        placeholder={t("admin.crm.sdr.manualBodyPlaceholder")}
        onFocus={() => {
          focusTarget.current = "body";
        }}
        onChange={(e) => onBody(e.target.value)}
      />
      <div className="flex flex-wrap gap-1.5">
        {MANUAL_TOKENS.map((tok) => (
          <Button
            key={tok.id}
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insert(tok.token)}
          >
            {t(`admin.crm.sdr.token.${tok.id}`)}
          </Button>
        ))}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {hint ? (
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground">{hint}</p>
        </CardContent>
      ) : null}
    </Card>
  );
}

export function AiSdrPanel() {
  const { t } = useTranslation();
  const staffProfiles = useStaffProfiles();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [campaigns, setCampaigns] = useState<SdrCampaign[]>([]);
  const [campaignId, setCampaignId] = useState<string>("");
  const [leads, setLeads] = useState<SdrLead[]>([]);
  const [metrics, setMetrics] = useState<SdrMetrics | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<SdrConversation[]>([]);
  const [leadSearch, setLeadSearch] = useState("");
  const [leadStatusFilter, setLeadStatusFilter] = useState<string>("all");
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(() => new Set());
  const [sdrSection, setSdrSection] = useState("enrich");
  const [editLead, setEditLead] = useState<SdrLead | null>(null);
  const [editDraft, setEditDraft] = useState({
    first_name: "",
    last_name: "",
    email: "",
    company: "",
    role: "",
    country: "",
    language: "es",
    industry: "",
    linkedin_url: "",
  });

  const [roles, setRoles] = useState(DEFAULT_SDR_ROLES.join(", "));
  const [countries, setCountries] = useState(DEFAULT_SDR_COUNTRIES.join(", "));
  const [industries, setIndustries] = useState("");
  const [companySizes, setCompanySizes] = useState(DEFAULT_SDR_COMPANY_SIZES.join("; "));
  const [enrichLimit, setEnrichLimit] = useState("20");
  const [excludeDomainsText, setExcludeDomainsText] = useState(DEFAULT_SDR_EXCLUDE_DOMAINS.join(", "));
  const [crmQuery, setCrmQuery] = useState("");
  const [crmHits, setCrmHits] = useState<CrmLeadPick[]>([]);
  const [excludeKnownCompanies, setExcludeKnownCompanies] = useState(true);

  const [agentLanguage, setAgentLanguage] = useState("es");
  const [agentPrompt, setAgentPrompt] = useState(DEFAULT_SDR_PROMPT);
  const [calendlyUrl, setCalendlyUrl] = useState("");
  const [calendlyOwnerId, setCalendlyOwnerId] = useState<string>("");
  const [outreachProvider, setOutreachProvider] = useState("smartlead");
  const [outreachCampaignId, setOutreachCampaignId] = useState("");
  const [settings, setSettings] = useState<SdrCampaignSettings>(DEFAULT_SDR_SETTINGS);
  const [showStepBriefs, setShowStepBriefs] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [mailboxes, setMailboxes] = useState<SmartleadMailbox[]>([]);
  const [mailboxId, setMailboxId] = useState("");
  const [mailboxesLoading, setMailboxesLoading] = useState(false);
  const [smartleadStatus, setSmartleadStatus] = useState<SmartleadCampaignStatus | null>(null);
  const [smartleadStatusLoading, setSmartleadStatusLoading] = useState(false);
  const refreshRequest = useRef(0);

  const patchSettings = (patch: Partial<SdrCampaignSettings>) => {
    setSettings((prev) => normalizeSdrSettings({ ...prev, ...patch }));
  };

  const campaign = useMemo(
    () => campaigns.find((c) => c.id === campaignId) ?? null,
    [campaigns, campaignId],
  );

  const smartleadKpis = useMemo((): SmartleadCampaignAnalytics => {
    const cached = readCachedSmartleadAnalytics(campaign?.metrics);
    const live = smartleadStatus?.analytics ?? null;
    return live ?? cached ?? EMPTY_SMARTLEAD_ANALYTICS;
  }, [campaign?.metrics, smartleadStatus]);

  const selectedLead = useMemo(
    () => leads.find((l) => l.id === selectedLeadId) ?? null,
    [leads, selectedLeadId],
  );

  const discoveredCount = useMemo(
    () => leads.filter((l) => l.status === "discovered").length,
    [leads],
  );

  const missingCountryCount = useMemo(
    () => leads.filter((l) => !l.country?.trim()).length,
    [leads],
  );

  const openEditLead = (lead: SdrLead) => {
    setEditLead(lead);
    setEditDraft({
      first_name: lead.first_name ?? "",
      last_name: lead.last_name ?? "",
      email: lead.email ?? "",
      company: lead.company ?? "",
      role: lead.role ?? "",
      country: lead.country ?? "",
      language: lead.language || agentLanguage || "es",
      industry: lead.industry ?? "",
      linkedin_url: lead.linkedin_url ?? "",
    });
  };

  const staffWithCalendly = useMemo(
    () =>
      staffProfiles.filter((p) => Boolean(p.calendly_url?.trim())),
    [staffProfiles],
  );

  useEffect(() => {
    if (!calendlyUrl) {
      setCalendlyOwnerId("");
      return;
    }
    const match = staffProfiles.find(
      (p) => (p.calendly_url || "").trim() === calendlyUrl.trim(),
    );
    setCalendlyOwnerId(match?.user_id ?? "custom");
  }, [calendlyUrl, staffProfiles]);

  const filteredLeads = useMemo(() => {
    const q = leadSearch.trim().toLowerCase();
    return leads.filter((lead) => {
      if (leadStatusFilter !== "all" && lead.status !== leadStatusFilter) return false;
      if (!q) return true;
      const hay = [
        lead.first_name,
        lead.last_name,
        lead.email,
        lead.company,
        lead.role,
        lead.country,
        lead.industry,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [leads, leadSearch, leadStatusFilter]);

  const allFilteredSelected =
    filteredLeads.length > 0 && filteredLeads.every((l) => selectedLeadIds.has(l.id));

  const refresh = useCallback(async (preferredCampaignId?: string) => {
    const requestId = ++refreshRequest.current;
    const stillCurrent = () => requestId === refreshRequest.current;
    setLoading(true);
    setMetrics(null);
    setSmartleadStatus(null);
    setSmartleadStatusLoading(false);
    if (preferredCampaignId) setCampaignId(preferredCampaignId);
    try {
      const list = await listSdrCampaigns();
      if (!stillCurrent()) return;
      setCampaigns(list);
      const activeId = preferredCampaignId
        || (list.some((c) => c.id === campaignId) ? campaignId : list[0]?.id)
        || "";
      setCampaignId(activeId);

      const active = list.find((c) => c.id === activeId);
      if (active) {
        setRoles(joinCsv(active.target_roles) || DEFAULT_SDR_ROLES.join(", "));
        setCountries(joinCsv(active.target_countries) || DEFAULT_SDR_COUNTRIES.join(", "));
        setIndustries(joinCsv(active.target_industries));
        setCompanySizes(joinApolloRanges(active.target_company_sizes) || DEFAULT_SDR_COMPANY_SIZES.join("; "));
        setAgentLanguage(active.agent_language || "es");
        setAgentPrompt(active.agent_prompt || DEFAULT_SDR_PROMPT);
        setCalendlyUrl(active.calendly_url || "");
        setOutreachProvider(active.outreach_provider || "smartlead");
        setOutreachCampaignId(active.outreach_campaign_id || "");
        const nextSettings = normalizeSdrSettings(active.settings);
        setSettings(nextSettings);
        setExcludeDomainsText(nextSettings.exclude_domains.join(", "));
        setExcludeKnownCompanies(nextSettings.exclude_known_companies);
      }

      if (!activeId) {
        setLeads([]);
        setMetrics(null);
        setSmartleadStatus(null);
        return;
      }

      const [leadRows, metricRows] = await Promise.all([
        listSdrLeads(activeId),
        fetchSdrMetrics(activeId),
      ]);
      if (!stillCurrent()) return;
      setLeads(leadRows);
      setMetrics(metricRows);
      setSelectedLeadId((current) =>
        current && leadRows.some((l) => l.id === current) ? current : null,
      );
      setSelectedLeadIds((prev) => {
        const valid = new Set(leadRows.map((l) => l.id));
        return new Set([...prev].filter((id) => valid.has(id)));
      });

      if (active?.outreach_provider === "smartlead" && active.outreach_campaign_id) {
        setSmartleadStatusLoading(true);
        try {
          const sl = await fetchSmartleadCampaignStatus({
            campaign_id: activeId,
            outreach_campaign_id: active.outreach_campaign_id,
          });
          if (!stillCurrent()) return;
          setSmartleadStatus(sl);
          const syncedLeads = await listSdrLeads(activeId);
          if (!stillCurrent()) return;
          setLeads(syncedLeads);
          if (sl.analytics) {
            setCampaigns((prev) => prev.map((c) => {
              if (c.id !== activeId) return c;
              const prevSmartlead = c.metrics.smartlead;
              const smartlead = prevSmartlead && typeof prevSmartlead === "object" &&
                  !Array.isArray(prevSmartlead)
                ? prevSmartlead as Record<string, unknown>
                : {};
              return {
                ...c,
                metrics: {
                  ...c.metrics,
                  smartlead: {
                    ...smartlead,
                    lead_count: sl.lead_count,
                    analytics: sl.analytics,
                  },
                },
              };
            }));
          }
        } catch {
          if (stillCurrent()) setSmartleadStatus(null);
        } finally {
          if (stillCurrent()) setSmartleadStatusLoading(false);
        }
      } else {
        setSmartleadStatus(null);
      }
    } catch (err) {
      if (stillCurrent()) {
        toast.error(err instanceof Error ? err.message : t("admin.crm.sdr.loadError"));
      }
    } finally {
      if (stillCurrent()) setLoading(false);
    }
  // campaignId intentionally omitted from deps: callers pass preferredCampaignId when switching
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (outreachProvider !== "smartlead") {
      setMailboxes([]);
      setMailboxId("");
      return;
    }
    let cancelled = false;
    setMailboxesLoading(true);
    void listSmartleadMailboxes()
      .then((list) => {
        if (cancelled) return;
        // Prefer brand mailboxes so other workspace inboxes are not auto-picked.
        const preferred = [...list].sort((a, b) => {
          const score = (m: SmartleadMailbox) => (isBrandMailbox(m.from_email) ? 0 : 1);
          return score(a) - score(b);
        });
        setMailboxes(preferred);
        setMailboxId((current) => {
          if (current && preferred.some((m) => String(m.id) === current)) return current;
          const brandBox = preferred.find((m) => isBrandMailbox(m.from_email));
          return brandBox ? String(brandBox.id) : (preferred[0] ? String(preferred[0].id) : "");
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setMailboxes([]);
        toast.error(err instanceof Error ? err.message : t("admin.crm.sdr.mailboxesError"));
      })
      .finally(() => {
        if (!cancelled) setMailboxesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [outreachProvider, t]);

  useEffect(() => {
    if (!selectedLeadId) {
      setConversations([]);
      return;
    }
    void listSdrConversations(selectedLeadId)
      .then(setConversations)
      .catch((err) => toast.error(err instanceof Error ? err.message : t("admin.crm.sdr.loadError")));
  }, [selectedLeadId, t]);

  useEffect(() => {
    const q = crmQuery.trim();
    if (q.length < 2) {
      setCrmHits([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void searchCrmLeadsForSdr(q)
        .then((rows) => {
          if (!cancelled) setCrmHits(rows);
        })
        .catch((err) => {
          if (cancelled) return;
          setCrmHits([]);
          toast.error(err instanceof Error ? err.message : t("admin.crm.sdr.crmSearchError"));
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [crmQuery, t]);

  const onCreateCampaign = async () => {
    const name = newCampaignName.trim() || `SDR ${new Date().toLocaleDateString()}`;
    setBusy(true);
    try {
      const created = await createSdrCampaign({
        name,
        agent_language: agentLanguage,
        agent_prompt: agentPrompt,
        calendly_url: calendlyUrl || null,
        outreach_provider: outreachProvider,
        outreach_campaign_id: null,
        target_roles: csv(roles),
        target_countries: csv(countries),
        target_industries: csv(industries),
        target_company_sizes: apolloEmployeeRanges(companySizes),
        settings,
      });
      setNewCampaignName("");
      toast.success(t("admin.crm.sdr.campaignCreated"));
      await refresh(created.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.crm.sdr.saveError"));
    } finally {
      setBusy(false);
    }
  };

  const openRenameCampaign = () => {
    if (!campaign) return;
    setRenameDraft(campaign.name);
    setRenameOpen(true);
  };

  const onRenameCampaign = async () => {
    if (!campaign) return;
    const name = renameDraft.trim();
    if (!name) {
      toast.error(t("admin.crm.sdr.renameEmpty"));
      return;
    }
    setBusy(true);
    try {
      await renameSdrCampaign(campaign.id, name);
      setRenameOpen(false);
      toast.success(t("admin.crm.sdr.campaignRenamed"));
      await refresh(campaign.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.crm.sdr.saveError"));
    } finally {
      setBusy(false);
    }
  };

  const onDeleteCampaign = async () => {
    if (!campaign) return;
    const ok = window.confirm(
      t("admin.crm.sdr.deleteCampaignConfirm", { name: campaign.name }),
    );
    if (!ok) return;
    setBusy(true);
    try {
      const deletedId = campaign.id;
      await deleteSdrCampaign(deletedId);
      toast.success(t("admin.crm.sdr.campaignDeleted"));
      setCampaignId("");
      setSelectedLeadIds(new Set());
      setSelectedLeadId(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.crm.sdr.deleteCampaignError"));
    } finally {
      setBusy(false);
    }
  };

  const onSaveCampaign = async () => {
    if (!campaign) return;
    setBusy(true);
    try {
      await updateSdrCampaign(campaign.id, {
        ...campaign,
        target_roles: csv(roles),
        target_countries: csv(countries),
        target_industries: csv(industries),
        target_company_sizes: apolloEmployeeRanges(companySizes),
        agent_language: agentLanguage as SdrCampaign["agent_language"],
        agent_prompt: agentPrompt,
        calendly_url: calendlyUrl || null,
        outreach_provider: outreachProvider as SdrCampaign["outreach_provider"],
        outreach_campaign_id: outreachCampaignId || null,
        settings: normalizeSdrSettings(settings),
      });
      toast.success(t("admin.crm.sdr.campaignSaved"));
      await refresh(campaign.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.crm.sdr.saveError"));
    } finally {
      setBusy(false);
    }
  };

  const onEnrich = async () => {
    if (!campaign) {
      toast.error(t("admin.crm.sdr.needCampaign"));
      return;
    }
    setBusy(true);
    try {
      const nextSettings = normalizeSdrSettings({
        ...settings,
        exclude_domains: csv(excludeDomainsText),
        exclude_known_companies: excludeKnownCompanies,
      });
      setSettings(nextSettings);
      await updateSdrCampaign(campaign.id, {
        ...campaign,
        target_roles: csv(roles),
        target_countries: csv(countries),
        target_industries: csv(industries),
        target_company_sizes: apolloEmployeeRanges(companySizes),
        settings: nextSettings,
      });
      const result = await enrichSdrLeads({
        campaign_id: campaign.id,
        roles: csv(roles),
        countries: csv(countries),
        industries: csv(industries),
        company_sizes: apolloEmployeeRanges(companySizes),
        limit: Number(enrichLimit) || 20,
        exclude_domains: nextSettings.exclude_domains,
        exclude_known_companies: nextSettings.exclude_known_companies,
      });
      if (result.inserted + result.updated === 0 && result.no_email > 0) {
        toast.warning(
          t("admin.crm.sdr.enrichNoEmails", {
            found: result.found,
            noEmail: result.no_email,
          }),
        );
      } else {
        toast.success(
          t("admin.crm.sdr.enrichDone", {
            found: result.found,
            inserted: result.inserted,
            updated: result.updated,
            noEmail: result.no_email,
          }),
        );
      }
      await refresh(campaign.id);
      setLeadStatusFilter("all");
      setSdrSection("leads");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.crm.sdr.enrichError"));
    } finally {
      setBusy(false);
    }
  };

  const onAddCrmLead = async (lead: CrmLeadPick) => {
    if (!campaign) {
      toast.error(t("admin.crm.sdr.needCampaign"));
      return;
    }
    if (!lead.email?.includes("@")) {
      toast.error(t("admin.crm.sdr.crmLeadNoEmail"));
      return;
    }
    setBusy(true);
    try {
      await addCrmLeadToSdrCampaign(campaign.id, lead);
      toast.success(t("admin.crm.sdr.crmLeadAdded", {
        name: [lead.nombre, lead.apellido].filter(Boolean).join(" ") || lead.empresa,
      }));
      setCrmQuery("");
      setCrmHits([]);
      setLeadStatusFilter("all");
      await refresh(campaign.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.crm.sdr.crmLeadAddError"));
    } finally {
      setBusy(false);
    }
  };

  const toggleLeadSelected = (id: string, checked: boolean) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleSelectAllFiltered = (checked: boolean) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      for (const lead of filteredLeads) {
        if (checked) next.add(lead.id);
        else next.delete(lead.id);
      }
      return next;
    });
  };

  const onChangeLeadLanguage = async (leadId: string, language: string) => {
    try {
      await updateSdrLeadLanguage(leadId, language);
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, language } : l)),
      );
      toast.success(t("admin.crm.sdr.languageUpdated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.crm.sdr.saveError"));
    }
  };

  const onSaveEditLead = async () => {
    if (!editLead) return;
    setBusy(true);
    try {
      const saved = await updateSdrLead(editLead.id, {
        first_name: editDraft.first_name,
        last_name: editDraft.last_name,
        email: editDraft.email,
        company: editDraft.company,
        role: editDraft.role,
        country: editDraft.country,
        language: editDraft.language,
        industry: editDraft.industry,
        linkedin_url: editDraft.linkedin_url,
      });
      setLeads((prev) => prev.map((l) => (l.id === saved.id ? saved : l)));
      setEditLead(null);
      toast.success(t("admin.crm.sdr.leadSaved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.crm.sdr.saveError"));
    } finally {
      setBusy(false);
    }
  };

  const onInferLocales = async () => {
    if (!campaign) {
      toast.error(t("admin.crm.sdr.needCampaign"));
      return;
    }
    const selected = [...selectedLeadIds];
    const targetIds = selected.length > 0
      ? selected
      : leads.filter((l) => !l.country?.trim()).map((l) => l.id);
    if (targetIds.length === 0) {
      toast.message(t("admin.crm.sdr.inferNothing"));
      return;
    }
    setBusy(true);
    try {
      const result = await inferSdrLeadLocales({
        campaign_id: campaign.id,
        lead_ids: targetIds,
        only_missing: selected.length === 0,
      });
      toast.success(
        t("admin.crm.sdr.inferDone", {
          updated: result.updated,
          scanned: result.scanned,
        }),
      );
      await refresh(campaign.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.crm.sdr.inferError"));
    } finally {
      setBusy(false);
    }
  };

  const onDeleteLeads = async (ids: string[]) => {
    if (ids.length === 0) return;
    if (!window.confirm(t("admin.crm.sdr.deleteConfirm", { count: ids.length }))) return;
    setBusy(true);
    try {
      const removed = await deleteSdrLeads(ids);
      toast.success(t("admin.crm.sdr.deletedToast", { count: removed }));
      if (campaign) await refresh(campaign.id);
      else setLeads((prev) => prev.filter((l) => !ids.includes(l.id)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.crm.sdr.deleteError"));
    } finally {
      setBusy(false);
    }
  };

  const onLaunchSelected = async () => {
    if (!campaign) {
      toast.error(t("admin.crm.sdr.needCampaign"));
      return;
    }
    const ids = [...selectedLeadIds];
    if (ids.length === 0) {
      toast.error(t("admin.crm.sdr.needLeadSelection"));
      return;
    }
    if (!outreachCampaignId.trim()) {
      toast.error(
        outreachProvider === "smartlead"
          ? t("admin.crm.sdr.needProvisionOrId")
          : t("admin.crm.sdr.needOutreachId"),
      );
      return;
    }
    const missingSelected = missingManualStep(settings);
    if (missingSelected) {
      toast.error(t("admin.crm.sdr.manualMissingStep", { step: missingSelected }));
      return;
    }
    setBusy(true);
    try {
      await persistCampaignConfig();
      const result = await launchSdrCampaign({
        campaign_id: campaign.id,
        outreach_campaign_id: outreachCampaignId.trim(),
        outreach_provider: outreachProvider,
        agent_prompt: agentPrompt,
        calendly_url: calendlyUrl,
        agent_language: agentLanguage,
        lead_ids: ids,
      });
      toast.success(
        `${t("admin.crm.sdr.launchDone", {
          count: result.uploaded || result.launched,
          provider: result.provider,
        })}${
          result.smartlead_lead_count != null
            ? ` · Smartlead: ${result.smartlead_lead_count} leads`
            : ""
        }`,
      );
      setSelectedLeadIds(new Set());
      await refresh(campaign.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.crm.sdr.launchError"));
    } finally {
      setBusy(false);
    }
  };

  const onProvisionSmartlead = async () => {
    if (!campaign) {
      toast.error(t("admin.crm.sdr.needCampaign"));
      return;
    }
    if (!mailboxId) {
      toast.error(t("admin.crm.sdr.needMailbox"));
      return;
    }
    setBusy(true);
    try {
      await updateSdrCampaign(campaign.id, {
        ...campaign,
        target_roles: csv(roles),
        target_countries: csv(countries),
        target_industries: csv(industries),
        target_company_sizes: apolloEmployeeRanges(companySizes),
        agent_language: agentLanguage as SdrCampaign["agent_language"],
        agent_prompt: agentPrompt,
        calendly_url: calendlyUrl || null,
        outreach_provider: "smartlead",
        outreach_campaign_id: outreachCampaignId || null,
        settings: normalizeSdrSettings(settings),
      });
      const hasExisting = Boolean(outreachCampaignId.trim());
      // Solo crea campaña nueva en Smartlead si el usuario lo confirma explícitamente.
      const forceNew = hasExisting
        ? window.confirm(t("admin.crm.sdr.reprovisionConfirm"))
        : false;
      const result = await provisionSmartleadCampaign({
        campaign_id: campaign.id,
        email_account_id: Number(mailboxId),
        name: campaign.name,
        outreach_campaign_id: outreachCampaignId.trim() || undefined,
        force_new: forceNew,
      });
      setOutreachCampaignId(result.outreach_campaign_id);
      setOutreachProvider("smartlead");
      toast.success(
        result.reused
          ? t("admin.crm.sdr.provisionReused", { id: result.outreach_campaign_id })
          : t("admin.crm.sdr.provisionDone", { id: result.outreach_campaign_id }),
      );
      await refresh(campaign.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.crm.sdr.provisionError"));
    } finally {
      setBusy(false);
    }
  };

  const persistCampaignConfig = async (prompt = agentPrompt) => {
    if (!campaign) return;
    await updateSdrCampaign(campaign.id, {
      ...campaign,
      target_roles: csv(roles),
      target_countries: csv(countries),
      target_industries: csv(industries),
      target_company_sizes: apolloEmployeeRanges(companySizes),
      agent_language: agentLanguage as SdrCampaign["agent_language"],
      agent_prompt: prompt,
      calendly_url: calendlyUrl || null,
      outreach_provider: outreachProvider as SdrCampaign["outreach_provider"],
      outreach_campaign_id: outreachCampaignId || null,
      settings: normalizeSdrSettings(settings),
    });
  };

  const onRepairSmartleadSequence = async () => {
    if (!campaign) {
      toast.error(t("admin.crm.sdr.needCampaign"));
      return;
    }
    if (!outreachCampaignId.trim()) {
      toast.error(t("admin.crm.sdr.needProvisionOrId"));
      return;
    }
    setBusy(true);
    try {
      await persistCampaignConfig();
      await repairSmartleadSequence({
        campaign_id: campaign.id,
        outreach_campaign_id: outreachCampaignId.trim(),
        email_account_id: mailboxId ? Number(mailboxId) : undefined,
        start: false,
      });
      toast.success(t("admin.crm.sdr.repairDone"));
      await refresh(campaign.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.crm.sdr.repairError"));
    } finally {
      setBusy(false);
    }
  };

  const onStartSmartlead = async () => {
    if (!campaign) {
      toast.error(t("admin.crm.sdr.needCampaign"));
      return;
    }
    if (!outreachCampaignId.trim()) {
      toast.error(t("admin.crm.sdr.needProvisionOrId"));
      return;
    }
    setBusy(true);
    try {
      await persistCampaignConfig();
      const result = await startSmartleadCampaign({
        campaign_id: campaign.id,
        outreach_campaign_id: outreachCampaignId.trim(),
        email_account_id: mailboxId ? Number(mailboxId) : undefined,
      });
      toast.success(
        t("admin.crm.sdr.startDone", {
          status: result.smartlead_status || "ACTIVE",
        }),
      );
      await refresh(campaign.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.crm.sdr.startError"));
    } finally {
      setBusy(false);
    }
  };

  const onLaunch = async () => {
    if (!campaign) {
      toast.error(t("admin.crm.sdr.needCampaign"));
      return;
    }
    if (!outreachCampaignId.trim()) {
      toast.error(
        outreachProvider === "smartlead"
          ? t("admin.crm.sdr.needProvisionOrId")
          : t("admin.crm.sdr.needOutreachId"),
      );
      return;
    }
    const discovered = leads.filter((l) => l.status === "discovered").length;
    if (discovered > 0) {
      const missingLaunch = missingManualStep(settings);
      if (missingLaunch) {
        toast.error(t("admin.crm.sdr.manualMissingStep", { step: missingLaunch }));
        return;
      }
    }
    setBusy(true);
    try {
      await persistCampaignConfig();
      const result = await launchSdrCampaign({
        campaign_id: campaign.id,
        outreach_campaign_id: outreachCampaignId.trim(),
        outreach_provider: outreachProvider,
        agent_prompt: agentPrompt,
        calendly_url: calendlyUrl,
        agent_language: agentLanguage,
        // Importa discovered; si no hay, reintenta contacted (fallo previo de import).
        relaunch_contacted: discovered === 0,
      });
      const slCount = result.smartlead_lead_count;
      toast.success(
        `${t("admin.crm.sdr.launchDone", {
          count: result.uploaded || result.launched,
          provider: result.provider,
        })}${slCount != null ? ` · Smartlead: ${slCount} leads` : ""}`,
      );
      await refresh(campaign.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.crm.sdr.launchError"));
    } finally {
      setBusy(false);
    }
  };

  const onRegenerateCopy = async () => {
    if (!campaign) {
      toast.error(t("admin.crm.sdr.needCampaign"));
      return;
    }
    if (!outreachCampaignId.trim()) {
      toast.error(
        outreachProvider === "smartlead"
          ? t("admin.crm.sdr.needProvisionOrId")
          : t("admin.crm.sdr.needOutreachId"),
      );
      return;
    }
    const manual = settings.copy_mode === "manual";
    if (manual) {
      const missing = missingManualStep(settings);
      if (missing) {
        toast.error(t("admin.crm.sdr.manualMissingStep", { step: missing }));
        return;
      }
    }
    if (!window.confirm(t(manual ? "admin.crm.sdr.generateManualConfirm" : "admin.crm.sdr.regenerateConfirm"))) return;
    const promptForRun = manual ? agentPrompt : DEFAULT_SDR_PROMPT;
    if (!manual) setAgentPrompt(DEFAULT_SDR_PROMPT);
    setBusy(true);
    let rewritten = 0;
    try {
      await persistCampaignConfig(promptForRun);
      const launchInput = {
        campaign_id: campaign.id,
        outreach_campaign_id: outreachCampaignId.trim(),
        outreach_provider: outreachProvider,
        agent_prompt: promptForRun,
        calendly_url: calendlyUrl,
        agent_language: agentLanguage,
        regenerate_copy: true,
      };
      let startWarning: string | null = null;
      for (let batch = 0; batch < 80; batch += 1) {
        const result = await launchSdrCampaign(launchInput);
        rewritten += result.launched;
        if (result.start_warning) startWarning = result.start_warning;
        const remaining = result.remaining ?? 0;
        if (result.done || remaining === 0 || result.launched === 0) break;
        toast.message(t("admin.crm.sdr.regenerateProgress", {
          done: rewritten,
          remaining,
        }));
      }
      toast.success(t("admin.crm.sdr.regenerateDone", { count: rewritten }));
      if (startWarning) toast.error(startWarning);
      await refresh(campaign.id);
    } catch (err) {
      const detail = err instanceof Error ? err.message : t("admin.crm.sdr.launchError");
      toast.error(
        rewritten > 0
          ? t("admin.crm.sdr.regeneratePartial", { count: rewritten, error: detail })
          : detail,
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        {t("admin.crm.sdr.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Bot className="w-5 h-5" />
              {t("admin.crm.sdr.title")}
            </h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              {t("admin.crm.sdr.subtitle")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("admin.crm.sdr.campaign")}</Label>
              <div className="flex gap-1.5 items-center">
                <Select
                  value={campaignId || undefined}
                  onValueChange={(id) => {
                    setCampaignId(id);
                    void refresh(id);
                  }}
                >
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder={t("admin.crm.sdr.selectCampaign")} />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  disabled={busy || !campaign}
                  title={t("admin.crm.sdr.renameCampaign")}
                  onClick={openRenameCampaign}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0 text-destructive hover:text-destructive"
                  disabled={busy || !campaign}
                  title={t("admin.crm.sdr.deleteCampaign")}
                  onClick={() => void onDeleteCampaign()}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("admin.crm.sdr.newCampaign")}</Label>
              <div className="flex gap-2">
                <Input
                  className="w-[180px]"
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  placeholder={t("admin.crm.sdr.campaignNamePlaceholder")}
                />
                <Button onClick={() => void onCreateCampaign()} disabled={busy}>
                  <Plus className="w-4 h-4 mr-1" />
                  {t("admin.crm.sdr.create")}
                </Button>
              </div>
            </div>
          </div>
        </div>
        {campaign ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              {t("admin.crm.sdr.crmStatusLabel")}:{" "}
              {t(`admin.crm.sdr.campaignStatus.${campaign.status}`)}
            </Badge>
            {campaign.outreach_provider === "smartlead" && campaign.outreach_campaign_id ? (
              <>
                <Badge
                  variant="outline"
                  className={smartleadStatusClass(smartleadStatus?.smartlead_status)}
                >
                  {t("admin.crm.sdr.smartleadStatusLabel")}:{" "}
                  {smartleadStatusLoading
                    ? "…"
                    : smartleadStatusLabel(smartleadStatus?.smartlead_status, t)}
                </Badge>
                {smartleadStatus?.outreach_campaign_id ? (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    ID {smartleadStatus.outreach_campaign_id}
                    {smartleadStatus.lead_count != null
                      ? ` · ${smartleadStatus.lead_count} leads`
                      : ""}
                  </span>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={busy || smartleadStatusLoading}
                  onClick={() => void refresh(campaign.id)}
                >
                  {smartleadStatusLoading
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : t("admin.crm.sdr.refreshSmartleadStatus")}
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("admin.crm.sdr.renameCampaignTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t("admin.crm.sdr.campaignNamePlaceholder")}</Label>
            <Input
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void onRenameCampaign();
              }}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRenameOpen(false)} disabled={busy}>
              {t("admin.crm.sdr.cancel")}
            </Button>
            <Button onClick={() => void onRenameCampaign()} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {t("admin.crm.sdr.saveRename")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-2">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard label={t("admin.crm.sdr.kpiLeads")} value={smartleadKpis.leads} />
          <MetricCard label={t("admin.crm.sdr.kpiSent")} value={smartleadKpis.sent} />
          <MetricCard label={t("admin.crm.sdr.kpiOpened")} value={smartleadKpis.opened} />
          <MetricCard label={t("admin.crm.sdr.kpiClicked")} value={smartleadKpis.clicked} />
          <MetricCard label={t("admin.crm.sdr.kpiReplied")} value={smartleadKpis.replied} />
          <MetricCard label={t("admin.crm.sdr.kpiRepliedOoo")} value={smartleadKpis.replied_ooo} />
          <MetricCard label={t("admin.crm.sdr.kpiPositive")} value={smartleadKpis.positive} />
          <MetricCard label={t("admin.crm.sdr.kpiBounced")} value={smartleadKpis.bounced} />
          <MetricCard label={t("admin.crm.sdr.kpiSenderBounced")} value={smartleadKpis.sender_bounced} />
          <MetricCard label={t("admin.crm.sdr.kpiDemos")} value={metrics?.demos_scheduled ?? 0} />
        </div>
        <p className="text-xs text-muted-foreground">{t("admin.crm.sdr.metricsFromSmartlead")}</p>
      </div>

      <Tabs value={sdrSection} onValueChange={setSdrSection}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="enrich" className="gap-2">
            <Search className="w-4 h-4" /> {t("admin.crm.sdr.tabEnrich")}
          </TabsTrigger>
          <TabsTrigger value="leads" className="gap-2">
            <Users className="w-4 h-4" /> {t("admin.crm.sdr.tabLeads")}
            {discoveredCount > 0 ? (
              <Badge variant="secondary" className="ml-1 tabular-nums">{discoveredCount}</Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="campaign" className="gap-2">
            <Target className="w-4 h-4" /> {t("admin.crm.sdr.tabCampaign")}
          </TabsTrigger>
          <TabsTrigger value="inbox" className="gap-2">
            <MessageSquare className="w-4 h-4" /> {t("admin.crm.sdr.tabInbox")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="enrich" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("admin.crm.sdr.enrichTitle")}</CardTitle>
              <CardDescription>{t("admin.crm.sdr.enrichDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("admin.crm.sdr.roles")}</Label>
                <Input value={roles} onChange={(e) => setRoles(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("admin.crm.sdr.countries")}</Label>
                <Input value={countries} onChange={(e) => setCountries(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("admin.crm.sdr.industries")}</Label>
                <Input value={industries} onChange={(e) => setIndustries(e.target.value)} />
              </div>
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label>{t("admin.crm.sdr.companySizes")}</Label>
                  <Input
                    value={companySizes}
                    onChange={(e) => setCompanySizes(e.target.value)}
                    placeholder="11,20; 21,50; 51,100; 101,200; 201,500"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("admin.crm.sdr.companySizesHint")}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("admin.crm.sdr.limit")}</Label>
                <Input value={enrichLimit} onChange={(e) => setEnrichLimit(e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>{t("admin.crm.sdr.excludeDomains")}</Label>
                <Textarea
                  className="min-h-[72px] text-sm"
                  value={excludeDomainsText}
                  onChange={(e) => setExcludeDomainsText(e.target.value)}
                  placeholder={t("admin.crm.sdr.excludeDomainsPlaceholder")}
                />
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="sdr-exclude-known"
                      checked={excludeKnownCompanies}
                      onCheckedChange={(v) => setExcludeKnownCompanies(v === true)}
                    />
                    <Label htmlFor="sdr-exclude-known" className="text-sm font-normal">
                      {t("admin.crm.sdr.excludeKnownCompanies")}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="sdr-lost-recontact" className="text-sm font-normal">
                      {t("admin.crm.sdr.lostRecontactDays")}
                    </Label>
                    <Input
                      id="sdr-lost-recontact"
                      type="number"
                      min={1}
                      max={365}
                      className="h-8 w-20"
                      disabled={!excludeKnownCompanies}
                      value={settings.lost_recontact_days}
                      onChange={(e) => patchSettings({
                        lost_recontact_days: Number(e.target.value) || 90,
                      })}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{t("admin.crm.sdr.excludeDomainsHint")}</p>
              </div>
              <div className="flex items-end">
                <Button onClick={() => void onEnrich()} disabled={busy || !campaign}>
                  {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                  {t("admin.crm.sdr.runEnrich")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaign" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("admin.crm.sdr.campaignConfigTitle")}</CardTitle>
              <CardDescription>{t("admin.crm.sdr.campaignConfigDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("admin.crm.sdr.fallbackLanguage")}</Label>
                <Select value={agentLanguage} onValueChange={setAgentLanguage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="es">ES</SelectItem>
                    <SelectItem value="en">EN</SelectItem>
                    <SelectItem value="de">DE</SelectItem>
                    <SelectItem value="fr">FR</SelectItem>
                    <SelectItem value="it">IT</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t("admin.crm.sdr.fallbackLanguageHint")}
                </p>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>{t("admin.crm.sdr.calendlyOwner")}</Label>
                <Select
                  value={calendlyOwnerId || undefined}
                  onValueChange={(id) => {
                    setCalendlyOwnerId(id);
                    if (id === "custom") return;
                    const person = staffProfiles.find((p) => p.user_id === id);
                    if (person?.calendly_url) setCalendlyUrl(person.calendly_url);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("admin.crm.sdr.calendlyOwnerPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {staffWithCalendly.map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>
                        {(p.full_name || p.work_email || p.user_id.slice(0, 8))}
                        {p.work_email ? ` · ${p.work_email}` : ""}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">{t("admin.crm.sdr.calendlyCustom")}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t("admin.crm.sdr.calendlyOwnerHint")}
                </p>
                {(calendlyOwnerId === "custom" || staffWithCalendly.length === 0) && (
                  <Input
                    className="mt-2"
                    value={calendlyUrl}
                    onChange={(e) => {
                      setCalendlyOwnerId("custom");
                      setCalendlyUrl(e.target.value);
                    }}
                    placeholder="https://calendly.com/..."
                  />
                )}
                {calendlyOwnerId && calendlyOwnerId !== "custom" && calendlyUrl ? (
                  <p className="text-xs text-muted-foreground break-all mt-1">{calendlyUrl}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>{t("admin.crm.sdr.provider")}</Label>
                <Select value={outreachProvider} onValueChange={setOutreachProvider}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="smartlead">Smartlead</SelectItem>
                    <SelectItem value="instantly">Instantly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {outreachProvider === "smartlead" ? (
                <div className="space-y-2">
                  <Label>{t("admin.crm.sdr.mailbox")}</Label>
                  <Select
                    value={mailboxId || undefined}
                    onValueChange={setMailboxId}
                    disabled={mailboxesLoading || mailboxes.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          mailboxesLoading
                            ? t("admin.crm.sdr.mailboxesLoading")
                            : t("admin.crm.sdr.selectMailbox")
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {mailboxes.map((m) => {
                        const otherBrand = !isBrandMailbox(m.from_email);
                        return (
                          <SelectItem key={m.id} value={String(m.id)}>
                            {m.from_name ? `${m.from_name} <${m.from_email}>` : m.from_email}
                            {m.is_smtp_success === false ? " (!SMTP)" : ""}
                            {otherBrand ? ` · ${t("admin.crm.sdr.mailboxOtherBrand")}` : ""}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {t("admin.crm.sdr.mailboxHint")}
                  </p>
                  {mailboxId && mailboxes.some((m) =>
                    String(m.id) === mailboxId && !isBrandMailbox(m.from_email)
                  ) ? (
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      {t("admin.crm.sdr.mailboxOtherBrandWarn")}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <div className="space-y-2">
                <Label>{t("admin.crm.sdr.outreachCampaignId")}</Label>
                <Input
                  value={outreachCampaignId}
                  onChange={(e) => setOutreachCampaignId(e.target.value)}
                  placeholder={t("admin.crm.sdr.outreachCampaignIdPlaceholder")}
                />
                {outreachProvider === "smartlead" ? (
                  <p className="text-xs text-muted-foreground">
                    {t("admin.crm.sdr.outreachIdAutoHint")}
                  </p>
                ) : null}
              </div>
              <div className="md:col-span-2 rounded-lg border border-border/60 p-4 space-y-4">
                <div>
                  <h4 className="text-sm font-medium">{t("admin.crm.sdr.settingsTitle")}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("admin.crm.sdr.settingsDesc")}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="sdr-enable-followup"
                        checked={settings.enable_followup}
                        onCheckedChange={(v) => patchSettings({ enable_followup: v === true })}
                      />
                      <Label htmlFor="sdr-enable-followup">{t("admin.crm.sdr.enableFollowup")}</Label>
                    </div>
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      disabled={!settings.enable_followup}
                      value={settings.followup_day}
                      onChange={(e) => patchSettings({ followup_day: Number(e.target.value) || 3 })}
                    />
                    <p className="text-[11px] text-muted-foreground">{t("admin.crm.sdr.followupDayHint")}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="sdr-enable-reminder"
                        checked={settings.enable_reminder}
                        onCheckedChange={(v) => patchSettings({ enable_reminder: v === true })}
                      />
                      <Label htmlFor="sdr-enable-reminder">{t("admin.crm.sdr.enableReminder")}</Label>
                    </div>
                    <Input
                      type="number"
                      min={1}
                      max={90}
                      disabled={!settings.enable_reminder}
                      value={settings.reminder_day}
                      onChange={(e) => patchSettings({ reminder_day: Number(e.target.value) || 7 })}
                    />
                    <p className="text-[11px] text-muted-foreground">{t("admin.crm.sdr.reminderDayHint")}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("admin.crm.sdr.lostAfterDays")}</Label>
                    <Input
                      type="number"
                      min={1}
                      max={180}
                      value={settings.lost_after_days}
                      onChange={(e) => patchSettings({ lost_after_days: Number(e.target.value) || 10 })}
                    />
                    <p className="text-[11px] text-muted-foreground">{t("admin.crm.sdr.lostAfterDaysHint")}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("admin.crm.sdr.timezone")}</Label>
                    <Select
                      value={settings.timezone}
                      onValueChange={(v) => patchSettings({ timezone: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Europe/Madrid">Europe/Madrid</SelectItem>
                        <SelectItem value="Europe/Paris">Europe/Paris</SelectItem>
                        <SelectItem value="Europe/Berlin">Europe/Berlin</SelectItem>
                        <SelectItem value="Europe/London">Europe/London</SelectItem>
                        <SelectItem value="Europe/Rome">Europe/Rome</SelectItem>
                        <SelectItem value="UTC">UTC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label>{t("admin.crm.sdr.startHour")}</Label>
                    <Input
                      value={settings.start_hour}
                      onChange={(e) => patchSettings({ start_hour: e.target.value })}
                      placeholder="09:00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("admin.crm.sdr.endHour")}</Label>
                    <Input
                      value={settings.end_hour}
                      onChange={(e) => patchSettings({ end_hour: e.target.value })}
                      placeholder="18:00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("admin.crm.sdr.minTimeBtwEmails")}</Label>
                    <Input
                      type="number"
                      min={1}
                      max={180}
                      value={settings.min_time_btw_emails}
                      onChange={(e) => patchSettings({ min_time_btw_emails: Number(e.target.value) || 12 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("admin.crm.sdr.maxLeadsPerDay")}</Label>
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      value={settings.max_new_leads_per_day}
                      onChange={(e) => patchSettings({ max_new_leads_per_day: Number(e.target.value) || 20 })}
                    />
                    <p className="text-xs text-muted-foreground">{t("admin.crm.sdr.maxLeadsPerDayHint")}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("admin.crm.sdr.sendDays")}</Label>
                  <div className="flex flex-wrap gap-3">
                    {WEEKDAY_KEYS.map((d) => {
                      const checked = settings.days_of_week.includes(d.value);
                      return (
                        <label key={d.value} className="flex items-center gap-1.5 text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              const next = v === true
                                ? [...settings.days_of_week, d.value]
                                : settings.days_of_week.filter((x) => x !== d.value);
                              patchSettings({ days_of_week: next.length ? next : [1, 2, 3, 4, 5] });
                            }}
                          />
                          {t(`admin.crm.sdr.${d.labelKey}`)}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-0 text-xs"
                    onClick={() => setShowStepBriefs((v) => !v)}
                  >
                    {showStepBriefs ? t("admin.crm.sdr.hideStepBriefs") : t("admin.crm.sdr.showStepBriefs")}
                  </Button>
                  {showStepBriefs ? (
                    <div className="mt-2 grid gap-3 md:grid-cols-3">
                      <div className="space-y-1">
                        <Label className="text-xs">{t("admin.crm.sdr.step1Brief")}</Label>
                        <Textarea
                          className="min-h-[80px] text-xs"
                          value={settings.step1_brief}
                          onChange={(e) => patchSettings({ step1_brief: e.target.value })}
                          placeholder={t("admin.crm.sdr.stepBriefPlaceholder")}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t("admin.crm.sdr.step2Brief")}</Label>
                        <Textarea
                          className="min-h-[80px] text-xs"
                          value={settings.step2_brief}
                          onChange={(e) => patchSettings({ step2_brief: e.target.value })}
                          placeholder={t("admin.crm.sdr.stepBriefPlaceholder")}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t("admin.crm.sdr.step3Brief")}</Label>
                        <Textarea
                          className="min-h-[80px] text-xs"
                          value={settings.step3_brief}
                          onChange={(e) => patchSettings({ step3_brief: e.target.value })}
                          placeholder={t("admin.crm.sdr.stepBriefPlaceholder")}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="space-y-3 md:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>{t("admin.crm.sdr.copyModeLabel")}</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={settings.copy_mode === "prompt" ? "default" : "outline"}
                      onClick={() => patchSettings({ copy_mode: "prompt" })}
                    >
                      {t("admin.crm.sdr.copyModePrompt")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={settings.copy_mode === "manual" ? "default" : "outline"}
                      onClick={() => patchSettings({ copy_mode: "manual" })}
                    >
                      {t("admin.crm.sdr.copyModeManual")}
                    </Button>
                  </div>
                </div>
                {settings.copy_mode === "manual" ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      {t("admin.crm.sdr.copyModeManualHint")}
                    </p>
                    <div className="grid gap-3 lg:grid-cols-3">
                      <ManualStepEditor
                        step={1}
                        enabled
                        subject={settings.manual_step1_subject}
                        body={settings.manual_step1_body}
                        onSubject={(value) => patchSettings({ manual_step1_subject: value })}
                        onBody={(value) => patchSettings({ manual_step1_body: value })}
                      />
                      <ManualStepEditor
                        step={2}
                        enabled={settings.enable_followup}
                        subject={settings.manual_step2_subject}
                        body={settings.manual_step2_body}
                        onSubject={(value) => patchSettings({ manual_step2_subject: value })}
                        onBody={(value) => patchSettings({ manual_step2_body: value })}
                      />
                      <ManualStepEditor
                        step={3}
                        enabled={settings.enable_reminder}
                        subject={settings.manual_step3_subject}
                        body={settings.manual_step3_body}
                        onSubject={(value) => patchSettings({ manual_step3_subject: value })}
                        onBody={(value) => patchSettings({ manual_step3_body: value })}
                      />
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label>{t("admin.crm.sdr.agentPrompt")}</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          setAgentPrompt(DEFAULT_SDR_PROMPT);
                          toast.message(t("admin.crm.sdr.promptResetHint"));
                        }}
                      >
                        {t("admin.crm.sdr.resetPrompt")}
                      </Button>
                    </div>
                    <Textarea
                      className="min-h-[220px] font-mono text-xs"
                      value={agentPrompt}
                      onChange={(e) => setAgentPrompt(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("admin.crm.sdr.promptCadenceHint")}
                    </p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {t("admin.crm.sdr.cadenceHint", {
                    followup: settings.followup_day,
                    reminder: settings.reminder_day,
                    lost: settings.lost_after_days,
                  })}
                </p>
              </div>
              <div className="md:col-span-2 flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void onSaveCampaign()} disabled={busy || !campaign}>
                  {t("admin.crm.sdr.saveCampaign")}
                </Button>
                {outreachProvider === "smartlead" ? (
                  <Button
                    variant="secondary"
                    onClick={() => void onProvisionSmartlead()}
                    disabled={busy || !campaign || !mailboxId || mailboxesLoading}
                  >
                    {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                    {outreachCampaignId
                      ? t("admin.crm.sdr.reprovisionSmartlead")
                      : t("admin.crm.sdr.provisionSmartlead")}
                  </Button>
                ) : null}
                {outreachProvider === "smartlead" && outreachCampaignId ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => void onRepairSmartleadSequence()}
                      disabled={busy || !campaign}
                    >
                      {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      {t("admin.crm.sdr.repairSequence")}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => void onStartSmartlead()}
                      disabled={busy || !campaign}
                    >
                      {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Rocket className="w-4 h-4 mr-2" />}
                      {t("admin.crm.sdr.startSmartlead")}
                    </Button>
                  </>
                ) : null}
                <Button onClick={() => void onLaunch()} disabled={busy || !campaign}>
                  {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Rocket className="w-4 h-4 mr-2" />}
                  {t("admin.crm.sdr.launch")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void onRegenerateCopy()}
                  disabled={busy || !campaign}
                >
                  {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : settings.copy_mode === "manual" ? <Mail className="w-4 h-4 mr-2" /> : null}
                  {settings.copy_mode === "manual"
                    ? t("admin.crm.sdr.generateManual")
                    : t("admin.crm.sdr.regenerateCopy")}
                </Button>
              </div>
              <div className="md:col-span-2 rounded-md border border-dashed border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground/80">{t("admin.crm.sdr.actionsLegendTitle")}</p>
                <p>{t("admin.crm.sdr.actionsLegendCreate")}</p>
                <p>{t("admin.crm.sdr.actionsLegendRepair")}</p>
                <p>{t("admin.crm.sdr.actionsLegendStart")}</p>
                <p>{t("admin.crm.sdr.actionsLegendLaunch")}</p>
                <p>{t("admin.crm.sdr.actionsLegendRegenerate")}</p>
                <p>{t("admin.crm.sdr.actionsLegendPaused")}</p>
              </div>
              <p className="md:col-span-2 text-xs text-muted-foreground">
                {t("admin.crm.sdr.gdprNote")}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leads" className="mt-4">
          <Card>
            <CardHeader className="space-y-3">
              <div>
                <CardTitle>{t("admin.crm.sdr.leadsTitle")}</CardTitle>
                <CardDescription>{t("admin.crm.sdr.leadsDesc")}</CardDescription>
              </div>
              <div className="space-y-2 rounded-md border border-border p-3">
                <Label>{t("admin.crm.sdr.addFromCrm")}</Label>
                <p className="text-xs text-muted-foreground">{t("admin.crm.sdr.addFromCrmHint")}</p>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    value={crmQuery}
                    onChange={(e) => setCrmQuery(e.target.value)}
                    placeholder={t("admin.crm.sdr.addFromCrmPlaceholder")}
                    disabled={!campaign}
                  />
                </div>
                {crmQuery.trim().length >= 2 ? (
                  <div className="max-h-56 overflow-y-auto rounded-md border border-border">
                    {crmHits.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-muted-foreground">{t("admin.crm.sdr.addFromCrmEmpty")}</p>
                    ) : crmHits.map((hit) => {
                      const hitName = [hit.nombre, hit.apellido].filter(Boolean).join(" ") || "—";
                      const canAdd = Boolean(hit.email?.includes("@"));
                      return (
                        <div key={hit.id} className="flex items-center gap-2 border-b border-border px-3 py-2 last:border-b-0">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{hitName}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {hit.empresa} · {hit.email || t("admin.crm.sdr.crmLeadNoEmail")}
                              {hit.cargo ? ` · ${hit.cargo}` : ""}
                            </p>
                          </div>
                          <Badge variant="outline">{t(`admin.crm.leadPhases.${hit.fase}`, { defaultValue: hit.fase })}</Badge>
                          {hit.archived ? (
                            <Badge variant="secondary">{t("admin.crm.sdr.archivedBadge")}</Badge>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={busy || !campaign || !canAdd}
                            onClick={() => void onAddCrmLead(hit)}
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            {t("admin.crm.sdr.addFromCrmAction")}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="space-y-1 flex-1 min-w-[180px]">
                  <Label className="text-xs text-muted-foreground">{t("admin.crm.sdr.searchLeads")}</Label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                    <Input
                      className="pl-8"
                      value={leadSearch}
                      onChange={(e) => setLeadSearch(e.target.value)}
                      placeholder={t("admin.crm.sdr.searchLeadsPlaceholder")}
                    />
                  </div>
                </div>
                <div className="space-y-1 w-full sm:w-[180px]">
                  <Label className="text-xs text-muted-foreground">{t("admin.crm.sdr.filterStatus")}</Label>
                  <Select value={leadStatusFilter} onValueChange={setLeadStatusFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("admin.crm.sdr.filterAllStatuses")}</SelectItem>
                      <SelectItem value="discovered">{t("admin.crm.sdr.leadStatus.discovered")}</SelectItem>
                      <SelectItem value="queued">{t("admin.crm.sdr.leadStatus.queued")}</SelectItem>
                      <SelectItem value="contacted">{t("admin.crm.sdr.leadStatus.contacted")}</SelectItem>
                      <SelectItem value="replied">{t("admin.crm.sdr.leadStatus.replied")}</SelectItem>
                      <SelectItem value="demo_requested">{t("admin.crm.sdr.leadStatus.demo_requested")}</SelectItem>
                      <SelectItem value="demo_scheduled">{t("admin.crm.sdr.leadStatus.demo_scheduled")}</SelectItem>
                      <SelectItem value="unsubscribed">{t("admin.crm.sdr.leadStatus.unsubscribed")}</SelectItem>
                      <SelectItem value="bounced">{t("admin.crm.sdr.leadStatus.bounced")}</SelectItem>
                      <SelectItem value="lost">{t("admin.crm.sdr.leadStatus.lost")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy || !campaign || (selectedLeadIds.size === 0 && missingCountryCount === 0)}
                    onClick={() => void onInferLocales()}
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
                    {selectedLeadIds.size > 0
                      ? t("admin.crm.sdr.inferSelected", { count: selectedLeadIds.size })
                      : t("admin.crm.sdr.inferMissing", { count: missingCountryCount })}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy || selectedLeadIds.size === 0}
                    onClick={() => void onDeleteLeads([...selectedLeadIds])}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    {t("admin.crm.sdr.deleteSelected", { count: selectedLeadIds.size })}
                  </Button>
                  <Button
                    size="sm"
                    disabled={busy || selectedLeadIds.size === 0 || !campaign}
                    onClick={() => void onLaunchSelected()}
                  >
                    <Rocket className="w-3.5 h-3.5 mr-1" />
                    {t("admin.crm.sdr.launchSelected", { count: selectedLeadIds.size })}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("admin.crm.sdr.leadsShowing", {
                  filtered: filteredLeads.length,
                  total: leads.length,
                  discovered: discoveredCount,
                })}
              </p>
            </CardHeader>
            <CardContent>
              {leads.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  {t("admin.crm.sdr.leadsEmpty")}
                </p>
              ) : filteredLeads.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  {t("admin.crm.sdr.leadsFilterEmpty")}
                </p>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={allFilteredSelected}
                            onCheckedChange={(v) => toggleSelectAllFiltered(v === true)}
                            aria-label={t("admin.crm.sdr.selectAll")}
                          />
                        </TableHead>
                        <TableHead>{t("admin.crm.sdr.colName")}</TableHead>
                        <TableHead>{t("admin.crm.sdr.colEmail")}</TableHead>
                        <TableHead>{t("admin.crm.sdr.colCompany")}</TableHead>
                        <TableHead>{t("admin.crm.sdr.colRole")}</TableHead>
                        <TableHead>{t("admin.crm.sdr.colCountry")}</TableHead>
                        <TableHead>{t("admin.crm.sdr.colLanguage")}</TableHead>
                        <TableHead>{t("admin.crm.sdr.colStatus")}</TableHead>
                        <TableHead>{t("admin.crm.sdr.colConsent")}</TableHead>
                        <TableHead className="w-[88px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLeads.map((lead) => {
                        const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "—";
                        return (
                          <TableRow
                            key={lead.id}
                            className={cn("cursor-pointer", selectedLeadId === lead.id && "bg-muted/50")}
                            onClick={() => setSelectedLeadId(lead.id)}
                          >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedLeadIds.has(lead.id)}
                                onCheckedChange={(v) => toggleLeadSelected(lead.id, v === true)}
                                aria-label={name}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{name}</TableCell>
                            <TableCell className="text-sm">{lead.email ?? "—"}</TableCell>
                            <TableCell>{lead.company ?? "—"}</TableCell>
                            <TableCell>{lead.role ?? "—"}</TableCell>
                            <TableCell>{lead.country ?? "—"}</TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Select
                                value={lead.language || agentLanguage || "es"}
                                onValueChange={(lang) => void onChangeLeadLanguage(lead.id, lang)}
                              >
                                <SelectTrigger className="h-8 w-[88px] uppercase text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="es">ES</SelectItem>
                                  <SelectItem value="en">EN</SelectItem>
                                  <SelectItem value="de">DE</SelectItem>
                                  <SelectItem value="fr">FR</SelectItem>
                                  <SelectItem value="it">IT</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={STATUS_COLORS[lead.status]}>
                                {t(`admin.crm.sdr.leadStatus.${lead.status}`)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {t(`admin.crm.sdr.consent.${lead.consent_status}`)}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <div className="flex gap-0.5">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  disabled={busy}
                                  onClick={() => openEditLead(lead)}
                                  aria-label={t("admin.crm.sdr.editLead")}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  disabled={busy}
                                  onClick={() => void onDeleteLeads([lead.id])}
                                  aria-label={t("admin.crm.sdr.deleteOne")}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
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

          <Dialog open={Boolean(editLead)} onOpenChange={(open) => !open && setEditLead(null)}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{t("admin.crm.sdr.editLeadTitle")}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>{t("admin.crm.sdr.colName")} (first)</Label>
                  <Input
                    value={editDraft.first_name}
                    onChange={(e) => setEditDraft((d) => ({ ...d, first_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t("admin.crm.sdr.colName")} (last)</Label>
                  <Input
                    value={editDraft.last_name}
                    onChange={(e) => setEditDraft((d) => ({ ...d, last_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>{t("admin.crm.sdr.colEmail")}</Label>
                  <Input
                    value={editDraft.email}
                    onChange={(e) => setEditDraft((d) => ({ ...d, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>{t("admin.crm.sdr.colCompany")}</Label>
                  <Input
                    value={editDraft.company}
                    onChange={(e) => setEditDraft((d) => ({ ...d, company: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t("admin.crm.sdr.colRole")}</Label>
                  <Input
                    value={editDraft.role}
                    onChange={(e) => setEditDraft((d) => ({ ...d, role: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t("admin.crm.sdr.colCountry")}</Label>
                  <Input
                    value={editDraft.country}
                    onChange={(e) => setEditDraft((d) => ({ ...d, country: e.target.value }))}
                    placeholder="Spain, Germany…"
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t("admin.crm.sdr.colLanguage")}</Label>
                  <Select
                    value={editDraft.language}
                    onValueChange={(language) => setEditDraft((d) => ({ ...d, language }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="es">ES</SelectItem>
                      <SelectItem value="en">EN</SelectItem>
                      <SelectItem value="de">DE</SelectItem>
                      <SelectItem value="fr">FR</SelectItem>
                      <SelectItem value="it">IT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>{t("admin.crm.sdr.colIndustry")}</Label>
                  <Input
                    value={editDraft.industry}
                    onChange={(e) => setEditDraft((d) => ({ ...d, industry: e.target.value }))}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>LinkedIn</Label>
                  <Input
                    value={editDraft.linkedin_url}
                    onChange={(e) => setEditDraft((d) => ({ ...d, linkedin_url: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditLead(null)}>
                  {t("admin.common.cancel")}
                </Button>
                <Button disabled={busy} onClick={() => void onSaveEditLead()}>
                  {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {t("admin.common.save")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="inbox" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("admin.crm.sdr.inboxLeads")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 max-h-[480px] overflow-y-auto">
                {leads.filter((l) => ["replied", "demo_requested", "demo_scheduled", "contacted"].includes(l.status)).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    {t("admin.crm.sdr.inboxEmpty")}
                  </p>
                ) : (
                  leads
                    .filter((l) => ["replied", "demo_requested", "demo_scheduled", "contacted", "unsubscribed"].includes(l.status))
                    .map((lead) => {
                      const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || lead.email || "—";
                      return (
                        <button
                          key={lead.id}
                          type="button"
                          className={cn(
                            "w-full text-left rounded-md px-3 py-2 text-sm hover:bg-muted/60",
                            selectedLeadId === lead.id && "bg-muted",
                          )}
                          onClick={() => setSelectedLeadId(lead.id)}
                        >
                          <div className="font-medium truncate">{name}</div>
                          <div className="text-xs text-muted-foreground truncate">{lead.company}</div>
                        </button>
                      );
                    })
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  {selectedLead
                    ? ([selectedLead.first_name, selectedLead.last_name].filter(Boolean).join(" ") || selectedLead.email)
                    : t("admin.crm.sdr.inboxTitle")}
                </CardTitle>
                <CardDescription>{t("admin.crm.sdr.inboxDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 max-h-[520px] overflow-y-auto">
                {!selectedLead ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    {t("admin.crm.sdr.selectLead")}
                  </p>
                ) : conversations.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    {t("admin.crm.sdr.noMessages")}
                  </p>
                ) : (
                  conversations.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "rounded-lg border p-3 text-sm space-y-1",
                        msg.sender === "agent" ? "bg-sky-500/5 border-sky-500/20" : "bg-muted/40",
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">
                          {msg.sender === "agent" ? t("admin.crm.sdr.senderAgent") : t("admin.crm.sdr.senderProspect")}
                        </Badge>
                        {msg.intent ? <span>{msg.intent}</span> : null}
                        <span className="ml-auto tabular-nums">
                          {new Date(msg.created_at).toLocaleString()}
                        </span>
                      </div>
                      {msg.subject ? <p className="font-medium">{msg.subject}</p> : null}
                      <p className="whitespace-pre-wrap text-foreground/90">{msg.message_body}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
