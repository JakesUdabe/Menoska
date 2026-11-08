"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar, ChevronDown, ChevronLeft, ChevronRight, Building2, Loader2, Plus, Save, Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/browser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { CrmPlaybookPanel } from "@/components/admin/core/CrmPlaybookPanel";
import {
  contactUrgency,
  groupLeadsByCompany,
  isContactSoon,
  todayIso,
  type CrmCompanyGroup,
} from "@/lib/admin/crm-commercial";
import { cn } from "@/lib/utils";
import type { CrmLead, LeadPhase } from "@/lib/admin/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const followupFrom = () => (supabase as any).from("mc_crm_followup_settings");

type CommercialStaff = { user_id: string; full_name: string | null };

const PIPELINE_PHASES: LeadPhase[] = ["nuevo", "contactado", "propuesta", "negociacion", "perdido"];
const EMPTY_DOMAIN_SET = new Set<string>();
const EMPTY_COMPANY_SET = new Set<string>();

const PHASE_COL: Record<LeadPhase, string> = {
  nuevo: "border-slate-500/40 bg-slate-500/5",
  contactado: "border-blue-500/40 bg-blue-500/5",
  propuesta: "border-violet-500/40 bg-violet-500/5",
  negociacion: "border-amber-500/40 bg-amber-500/5",
  convertido: "border-emerald-500/40 bg-emerald-500/5",
  perdido: "border-red-500/40 bg-red-500/5",
};

/** Approximate height of a compact pipeline row (incl. gap). */
const COLUMN_ROW_PX = 58;
const COLUMN_LOAD_MORE_PX = 36;
/** Approximate card size in the phase browse grid. */
const BROWSE_CARD_W = 200;
const BROWSE_CARD_H = 92;
const BROWSE_GAP = 8;

type Props = {
  leads: CrmLead[];
  /** Unused. The commercial agent is not part of this admin. */
  startup?: unknown;
  onRefresh?: () => Promise<void>;
  onOpenLead: (lead: CrmLead) => void;
  isSuperAdmin?: boolean;
  commercialStaff?: CommercialStaff[];
  pipelineOwnerId?: string;
  onPipelineOwnerChange?: (ownerId: string) => void;
  /** Superadmin can open email drafts; CRM-only cannot enter email. */
  canAccessEmail?: boolean;
};

export function CrmPipelinePanel({
  leads,
  onOpenLead,
  isSuperAdmin = false,
  commercialStaff = [],
  pipelineOwnerId = "all",
  onPipelineOwnerChange,
}: Props) {
  const { t } = useTranslation();
  const today = todayIso();
  const [followupDays, setFollowupDays] = useState<number[]>([3, 7, 14]);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [filterSoon, setFilterSoon] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [playbookOpen, setPlaybookOpen] = useState(false);
  const [browsePhase, setBrowsePhase] = useState<LeadPhase | null>(null);
  const [browsePage, setBrowsePage] = useState(1);
  const [browseCompanyKey, setBrowseCompanyKey] = useState<string | null>(null);

  // Include archived leads (industrial archive sits in "nuevo"); only drop converted.
  // Apollo finds stay in the Leads directory until Smartlead sends the first email.
  const pipelineLeads = useMemo(
    () => leads.filter((l) => {
      if (l.is_converted || l.fase === "convertido") return false;
      if (l.fuente === "ai_sdr" && l.fase === "nuevo") return false;
      return true;
    }),
    [leads],
  );

  const visibleLeads = useMemo(() => {
    if (!filterSoon) return pipelineLeads;
    return pipelineLeads.filter(
      (l) => l.fase !== "perdido" && l.fase !== "convertido" && isContactSoon(l.proximo_contacto, today),
    );
  }, [pipelineLeads, filterSoon, today]);

  /** Companies per phase — columns and browse render these, not 3k+ contact rows. */
  const byPhaseCompanies = useMemo(() => {
    const leadsByPhase = Object.fromEntries(
      PIPELINE_PHASES.map((p) => [p, [] as CrmLead[]]),
    ) as Record<LeadPhase, CrmLead[]>;
    for (const lead of visibleLeads) {
      const phase = PIPELINE_PHASES.includes(lead.fase) ? lead.fase : "nuevo";
      leadsByPhase[phase].push(lead);
    }

    const map = Object.fromEntries(
      PIPELINE_PHASES.map((p) => [p, [] as CrmCompanyGroup[]]),
    ) as Record<LeadPhase, CrmCompanyGroup[]>;

    for (const phase of PIPELINE_PHASES) {
      const groups = groupLeadsByCompany(
        leadsByPhase[phase],
        EMPTY_DOMAIN_SET,
        EMPTY_COMPANY_SET,
        EMPTY_DOMAIN_SET,
        EMPTY_COMPANY_SET,
      );
      groups.sort((a, b) => {
        const ua = contactUrgency(a.nextContact, today);
        const ub = contactUrgency(b.nextContact, today);
        const rank = (u: string) => (u === "overdue" ? 0 : u === "soon" ? 1 : 2);
        const cmp = rank(ua) - rank(ub);
        if (cmp !== 0) return cmp;
        if (a.contactCount !== b.contactCount) return b.contactCount - a.contactCount;
        return (a.nextContact ?? "9999").localeCompare(b.nextContact ?? "9999");
      });
      map[phase] = groups;
    }
    return map;
  }, [visibleLeads, today]);

  const soonCount = useMemo(
    () => pipelineLeads.filter(
      (l) => l.fase !== "perdido" && l.fase !== "convertido" && isContactSoon(l.proximo_contacto, today),
    ).length,
    [pipelineLeads, today],
  );

  const browseCompanies = browsePhase ? byPhaseCompanies[browsePhase] : [];
  const browseCompany = useMemo(
    () => (browseCompanyKey
      ? browseCompanies.find((g) => g.key === browseCompanyKey) ?? null
      : null),
    [browseCompanies, browseCompanyKey],
  );

  const openPhaseBrowse = (phase: LeadPhase) => {
    setBrowsePhase(phase);
    setBrowsePage(1);
    setBrowseCompanyKey(null);
  };

  const openCompanyFromPhase = (phase: LeadPhase, companyKey: string) => {
    setBrowsePhase(phase);
    setBrowseCompanyKey(companyKey);
    setBrowsePage(1);
  };

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const { data, error } = await followupFrom()
        .select("followup_days")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      const days = data?.followup_days as number[] | undefined;
      if (Array.isArray(days) && days.length > 0) setFollowupDays(days);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.crm.loadError"));
    } finally {
      setSettingsLoading(false);
    }
  }, [t]);

  useEffect(() => { void loadSettings(); }, [loadSettings]);

  const saveFollowupDays = async (days: number[]) => {
    if (days.length === 0) {
      toast.message(t("admin.crm.pipelineDaysRequired"));
      return;
    }
    setSavingSettings(true);
    try {
      const { error } = await followupFrom()
        .upsert({ id: 1, followup_days: days, updated_at: new Date().toISOString() });
      if (error) throw error;
      setFollowupDays(days);
      toast.success(t("admin.crm.pipelineDaysSaved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.crm.loadError"));
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-4 w-full min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{t("admin.crm.pipelineBoardTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("admin.crm.pipelineBoardDescSimple")}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {isSuperAdmin && onPipelineOwnerChange && (
            <div className="space-y-1 min-w-[200px]">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                {t("admin.crm.pipelineFilterOwner")}
              </Label>
              <Select value={pipelineOwnerId} onValueChange={onPipelineOwnerChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
          )}
          <Button
            type="button"
            variant={filterSoon ? "default" : "outline"}
            size="sm"
            className="gap-2"
            onClick={() => setFilterSoon((v) => !v)}
          >
            <Calendar className="w-4 h-4" />
            {t("admin.crm.pipelineFilterSoon")}
            {soonCount > 0 && (
              <Badge variant={filterSoon ? "secondary" : "outline"} className="tabular-nums">
                {soonCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left"
            >
              <div>
                <CardTitle className="text-base">{t("admin.crm.pipelineFollowupsTitle")}</CardTitle>
                <CardDescription className="mt-1">{t("admin.crm.pipelineFollowupsDesc")}</CardDescription>
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                  settingsOpen && "rotate-180",
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {settingsLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ContactTimingEditor
                  days={followupDays}
                  saving={savingSettings}
                  onSave={(days) => void saveFollowupDays(days)}
                />
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <div className="grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5 lg:gap-3">
        {PIPELINE_PHASES.map((phase) => (
          <PhaseColumn
            key={phase}
            phase={phase}
            companies={byPhaseCompanies[phase]}
            today={today}
            selectedCompanyKey={browsePhase === phase ? browseCompanyKey : null}
            onOpenCompany={(key) => openCompanyFromPhase(phase, key)}
            onLoadMore={() => openPhaseBrowse(phase)}
          />
        ))}
      </div>

      <Collapsible open={playbookOpen} onOpenChange={setPlaybookOpen}>
        <div className="rounded-lg border">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <div>
                <h3 className="text-base font-semibold">{t("admin.crm.tabPlaybook")}</h3>
                <p className="text-sm text-muted-foreground">{t("admin.crm.pipelinePlaybookDesc")}</p>
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                  playbookOpen && "rotate-180",
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t px-4 py-4">
              <CrmPlaybookPanel />
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {browsePhase && (
        <PhaseBrowseSheet
          phase={browsePhase}
          companies={browseCompanies}
          company={browseCompany}
          page={browsePage}
          today={today}
          onPageChange={setBrowsePage}
          onClose={() => {
            setBrowsePhase(null);
            setBrowseCompanyKey(null);
          }}
          onBackToCompanies={() => setBrowseCompanyKey(null)}
          onSelectCompany={setBrowseCompanyKey}
          onSelectLead={(lead) => {
            // Close browse first — nested Sheets leave body pointer-events locked
            // and the CRM underneath looks collapsed / unusable after writing emails.
            setBrowsePhase(null);
            setBrowseCompanyKey(null);
            queueMicrotask(() => onOpenLead(lead));
          }}
        />
      )}
    </div>
  );
}

function ContactTimingEditor({
  days,
  saving,
  onSave,
}: {
  days: number[];
  saving: boolean;
  onSave: (days: number[]) => void;
}) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<number[]>(days);

  useEffect(() => { setRows(days); }, [days]);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {rows.map((day, index) => (
          <div key={index} className="flex items-end gap-2 rounded-md border p-2 bg-background/60">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">
                {t("admin.crm.pipelineContactN", { n: index + 1 })}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={day}
                  onChange={(e) => {
                    const n = Number.parseInt(e.target.value, 10);
                    setRows((prev) => prev.map((v, i) => (i === index ? (Number.isFinite(n) ? n : v) : v)));
                  }}
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {t("admin.crm.pipelineDaysUnit")}
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={rows.length <= 1}
              onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
            >
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1"
          disabled={rows.length >= 12}
          onClick={() => setRows((prev) => [...prev, Math.max(1, (prev[prev.length - 1] ?? 7) + 7)])}
        >
          <Plus className="w-3.5 h-3.5" />
          {t("admin.crm.pipelineAddContact")}
        </Button>
        <Button
          type="button"
          size="sm"
          className="gap-1"
          disabled={saving}
          onClick={() => onSave(rows.filter((n) => Number.isFinite(n) && n > 0 && n <= 365))}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {t("admin.common.save")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("admin.crm.pipelineDaysHintDetailed")}</p>
    </div>
  );
}

function PhaseColumn({
  phase,
  companies,
  today,
  selectedCompanyKey,
  onOpenCompany,
  onLoadMore,
}: {
  phase: LeadPhase;
  companies: CrmCompanyGroup[];
  today: string;
  selectedCompanyKey: string | null;
  onOpenCompany: (key: string) => void;
  onLoadMore: () => void;
}) {
  const { t } = useTranslation();
  const listRef = useRef<HTMLDivElement>(null);
  const [fitCount, setFitCount] = useState(6);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const measure = () => {
      const h = el.clientHeight;
      if (h <= 0) return;
      const needsMore = companies.length > Math.max(1, Math.floor(h / COLUMN_ROW_PX));
      const usable = needsMore ? Math.max(0, h - COLUMN_LOAD_MORE_PX) : h;
      setFitCount(Math.max(1, Math.floor(usable / COLUMN_ROW_PX)));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [companies.length]);

  const preview = companies.slice(0, fitCount);
  const remaining = Math.max(0, companies.length - preview.length);
  const contactTotal = companies.reduce((n, g) => n + g.contactCount, 0);

  return (
    <div
      className={cn(
        "flex min-h-[16rem] min-w-0 flex-col rounded-lg border lg:min-h-[calc(100vh-14rem)]",
        PHASE_COL[phase],
      )}
    >
      <button
        type="button"
        className="flex items-center justify-between gap-2 border-b border-border/60 px-2.5 py-2 text-left hover:bg-background/40 transition-colors"
        onClick={onLoadMore}
        title={t("admin.crm.pipelineBrowseDesc")}
      >
        <span className="truncate text-[11px] font-semibold uppercase tracking-wide">
          {t(`admin.leadPhases.${phase}`)}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <Badge variant="secondary" className="tabular-nums">
            {companies.length}
          </Badge>
          {contactTotal > companies.length && (
            <span className="text-[10px] text-muted-foreground tabular-nums">
              · {contactTotal}
            </span>
          )}
        </div>
      </button>
      <div ref={listRef} className="flex min-h-0 flex-1 flex-col overflow-hidden p-1.5">
        {companies.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            {t("admin.crm.pipelineColumnEmpty")}
          </p>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-1 overflow-hidden">
              {preview.map((group) => (
                <PipelineCompanyRow
                  key={group.key}
                  group={group}
                  today={today}
                  selected={selectedCompanyKey === group.key}
                  onOpen={() => onOpenCompany(group.key)}
                />
              ))}
            </div>
            {remaining > 0 && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-1 h-8 w-full shrink-0 text-xs"
                onClick={onLoadMore}
              >
                {t("admin.crm.pipelineLoadMoreCompanies", { count: remaining })}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PhaseBrowseSheet({
  phase,
  companies,
  company,
  page,
  today,
  onPageChange,
  onClose,
  onBackToCompanies,
  onSelectCompany,
  onSelectLead,
}: {
  phase: LeadPhase;
  companies: CrmCompanyGroup[];
  company: CrmCompanyGroup | null;
  page: number;
  today: string;
  onPageChange: (page: number) => void;
  onClose: () => void;
  onBackToCompanies: () => void;
  onSelectCompany: (key: string) => void;
  onSelectLead: (lead: CrmLead) => void;
}) {
  const { t } = useTranslation();
  const gridRef = useRef<HTMLDivElement>(null);
  const [pageSize, setPageSize] = useState(24);

  useEffect(() => {
    const el = gridRef.current;
    if (!el || company) return;

    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w <= 0 || h <= 0) return;
      const cols = Math.max(1, Math.floor((w + BROWSE_GAP) / (BROWSE_CARD_W + BROWSE_GAP)));
      const rows = Math.max(1, Math.floor((h + BROWSE_GAP) / (BROWSE_CARD_H + BROWSE_GAP)));
      setPageSize(cols * rows);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [company]);

  const totalPages = Math.max(1, Math.ceil(companies.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  useEffect(() => {
    if (!company && page !== safePage) onPageChange(safePage);
  }, [company, page, safePage, onPageChange]);

  const pageCompanies = companies.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <Sheet open onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        className="flex h-full w-screen max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
      >
        <SheetHeader className="shrink-0 space-y-1 border-b px-6 py-4 pr-12 text-left">
          {company ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-2 w-fit gap-1"
                onClick={onBackToCompanies}
              >
                <ChevronLeft className="h-4 w-4" />
                {t("admin.crm.backToCompanies")}
              </Button>
              <SheetTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary shrink-0" />
                <span className="truncate">{company.companyName}</span>
              </SheetTitle>
              <SheetDescription>
                {company.domain && (
                  <span className="font-mono text-xs mr-2">{company.domain}</span>
                )}
                {t("admin.crm.companyContactsCount", { count: company.contactCount })}
                {" · "}
                {t(`admin.leadPhases.${phase}`)}
              </SheetDescription>
            </>
          ) : (
            <>
              <SheetTitle>
                {t(`admin.leadPhases.${phase}`)}
                <span className="ml-2 text-base font-normal text-muted-foreground tabular-nums">
                  ({companies.length} {t("admin.crm.pipelineCompaniesLabel")})
                </span>
              </SheetTitle>
              <SheetDescription>{t("admin.crm.pipelineBrowseCompaniesDesc")}</SheetDescription>
            </>
          )}
        </SheetHeader>

        {company ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="mx-auto max-w-3xl space-y-1.5">
              {company.contacts.map((lead) => (
                <PipelineContactRow
                  key={lead.id}
                  lead={lead}
                  today={today}
                  onSelect={() => onSelectLead(lead)}
                />
              ))}
            </div>
          </div>
        ) : (
          <>
            <div ref={gridRef} className="min-h-0 flex-1 overflow-hidden p-4">
              <div
                className="grid h-full content-start gap-2"
                style={{
                  gridTemplateColumns: `repeat(auto-fill, minmax(${BROWSE_CARD_W}px, 1fr))`,
                }}
              >
                {pageCompanies.map((group) => (
                  <PipelineCompanyCard
                    key={group.key}
                    group={group}
                    today={today}
                    onSelect={() => onSelectCompany(group.key)}
                  />
                ))}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t px-6 py-3">
              <p className="text-sm text-muted-foreground tabular-nums">
                {t("admin.crm.pipelineBrowseSheet", { current: safePage, total: totalPages })}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={safePage <= 1}
                  onClick={() => onPageChange(safePage - 1)}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  {t("admin.crm.previous")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={safePage >= totalPages}
                  onClick={() => onPageChange(safePage + 1)}
                >
                  {t("admin.crm.next")}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function PipelineCompanyCard({
  group,
  today,
  onSelect,
}: {
  group: CrmCompanyGroup;
  today: string;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const urgency = contactUrgency(group.nextContact, today);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex h-[84px] flex-col rounded-md border bg-card px-2.5 py-2 text-left transition-colors hover:bg-accent/40",
        urgency === "overdue" && "border-red-500/40",
        urgency === "soon" && "border-emerald-500/40",
      )}
    >
      <div className="flex items-start justify-between gap-1.5">
        <p className="line-clamp-2 text-xs font-medium leading-snug">{group.companyName}</p>
        <Badge variant="secondary" className="h-5 shrink-0 px-1 text-[10px] tabular-nums">
          {group.contactCount}
        </Badge>
      </div>
      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
        {group.domain || t("admin.crm.companyContactsCount", { count: group.contactCount })}
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-x-2 text-[10px] text-muted-foreground">
        {group.nextContact ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-medium",
              urgency === "overdue" && "text-red-600 dark:text-red-400",
              urgency === "soon" && "text-emerald-600 dark:text-emerald-400",
            )}
          >
            <Calendar className="h-2.5 w-2.5" />
            {group.nextContact}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function PipelineCompanyRow({
  group,
  today,
  selected,
  onOpen,
}: {
  group: CrmCompanyGroup;
  today: string;
  selected: boolean;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const urgency = contactUrgency(group.nextContact, today);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "w-full rounded-md border bg-card px-2 py-1.5 text-left transition-colors hover:bg-accent/40",
        selected && "ring-2 ring-primary/40",
        urgency === "overdue" && "border-red-500/40",
        urgency === "soon" && "border-emerald-500/40",
      )}
    >
      <div className="flex items-start justify-between gap-1.5">
        <p className="text-xs font-medium leading-snug line-clamp-2 flex items-center gap-1">
          <Building2 className="w-3 h-3 text-muted-foreground shrink-0" />
          <span className="line-clamp-2">{group.companyName}</span>
        </p>
        <Badge variant="secondary" className="h-5 shrink-0 px-1 text-[9px] tabular-nums font-normal">
          {t("admin.crm.pipelineCompanyContactsShort", { count: group.contactCount })}
        </Badge>
      </div>
      {group.nextContact ? (
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-medium",
              urgency === "overdue" && "text-red-600 dark:text-red-400",
              urgency === "soon" && "text-emerald-600 dark:text-emerald-400",
            )}
          >
            <Calendar className="h-2.5 w-2.5" />
            {group.nextContact}
            {urgency === "overdue" && ` · ${t("admin.crm.pipelineOverdue")}`}
            {urgency === "soon" && ` · ${t("admin.crm.pipelineSoonLabel")}`}
          </span>
        </div>
      ) : null}
    </button>
  );
}

function PipelineContactRow({
  lead,
  today,
  onSelect,
}: {
  lead: CrmLead;
  today: string;
  onSelect: () => void;
}) {
  const showNext = lead.fase !== "perdido" && lead.fase !== "convertido" && !!lead.proximo_contacto;
  const urgency = showNext ? contactUrgency(lead.proximo_contacto, today) : "later";
  const contactName = [lead.nombre, lead.apellido].filter(Boolean).join(" ") || lead.email || "—";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-md border bg-card px-3 py-2.5 text-left transition-colors hover:bg-accent/40",
        showNext && urgency === "overdue" && "border-red-500/40",
        showNext && urgency === "soon" && "border-emerald-500/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{contactName}</p>
          <p className="text-xs text-muted-foreground truncate">
            {lead.cargo || "—"}
          </p>
        </div>
      </div>
      {showNext && (
        <p
          className={cn(
            "mt-1 text-[11px] inline-flex items-center gap-1",
            urgency === "overdue" && "text-red-600 dark:text-red-400",
            urgency === "soon" && "text-emerald-600 dark:text-emerald-400",
            urgency === "later" && "text-muted-foreground",
          )}
        >
          <Calendar className="h-3 w-3" />
          {lead.proximo_contacto}
        </p>
      )}
    </button>
  );
}
