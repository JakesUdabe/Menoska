"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, Plus, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CRM_ACCOUNT_TYPES, CRM_ACTIVITY_TYPES, CRM_PLAN_TARGETS, CRM_STATUS_OPTIONS,
  canGenerateOutreach, defaultEmailCopy, defaultPostDemoNote, leadFieldsFromStatusOption,
  statusOptionFromLead, syncProximoFromUltimo, todayIso,
  type CrmStatusOption, type CommercialSender, DEFAULT_SENDER,
} from "@/lib/admin/crm-commercial";
import { cn } from "@/lib/utils";
import type {
  CrmActivity, CrmLead, CrmPlanTarget, LeadPhase,
} from "@/lib/admin/types";

type Staff = { user_id: string; full_name: string | null };

export function CrmLeadWorkbench({
  lead,
  commercialStaff,
  senders,
  open,
  onClose,
  onSaved,
  canAccessEmail = false,
  currentUserId,
  isSuperAdmin = false,
  companyDefaults = null,
}: {
  lead: CrmLead | null;
  commercialStaff: Staff[];
  senders: CommercialSender[];
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
  canAccessEmail?: boolean;
  currentUserId?: string;
  isSuperAdmin?: boolean;
  /** Prefill when creating a contact from a company panel (CIF lives on the company). */
  companyDefaults?: { empresa?: string; cif?: string | null } | null;
}) {
  const { t } = useTranslation();
  const isNew = !lead;
  const [saving, setSaving] = useState(false);
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [note, setNote] = useState("");
  const [noteType, setNoteType] = useState<(typeof CRM_ACTIVITY_TYPES)[number]>("nota");
  const [senderId, setSenderId] = useState(senders[0]?.userId ?? DEFAULT_SENDER.userId);
  const [emailSubject, setEmailSubject] = useState("");
  const [workbenchTab, setWorkbenchTab] = useState("ficha");

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [cargo, setCargo] = useState("");
  const [web, setWeb] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [region, setRegion] = useState("");
  const [comercialId, setComercialId] = useState("");
  const [fase, setFase] = useState<LeadPhase>("nuevo");
  const [tipoCuenta, setTipoCuenta] = useState<(typeof CRM_ACCOUNT_TYPES)[number]>("consultora");
  const [planObjetivo, setPlanObjetivo] = useState<CrmPlanTarget>("business");
  const [gancho, setGancho] = useState("");
  const [comentarios, setComentarios] = useState("");
  const [emailCopy, setEmailCopy] = useState("");
  const [ultimo, setUltimo] = useState("");
  const [proximo, setProximo] = useState("");
  const [contactCount, setContactCount] = useState(0);

  useEffect(() => {
    if (!open) return;
    setWorkbenchTab("ficha");
  }, [open, lead?.id]);

  useEffect(() => {
    if (!canAccessEmail && workbenchTab === "copys") {
      setWorkbenchTab("ficha");
    }
  }, [canAccessEmail, workbenchTab]);

  useEffect(() => {
    if (!open) return;
    setNombre(lead?.nombre ?? "");
    setApellido(lead?.apellido ?? "");
    setEmail(lead?.email ?? "");
    setEmpresa(lead?.empresa ?? companyDefaults?.empresa ?? "");
    setCargo(lead?.cargo ?? "");
    setWeb(lead?.web ?? "");
    setLinkedinUrl(lead?.linkedin_url ?? "");
    setRegion(lead?.region ?? "");
    setComercialId(lead?.comercial_id ?? commercialStaff[0]?.user_id ?? "");
    setFase(lead?.fase ?? "nuevo");
    setTipoCuenta(lead?.tipo_cuenta ?? "consultora");
    setPlanObjetivo(lead?.plan_objetivo ?? "business");
    setGancho(lead?.gancho ?? "");
    setComentarios(lead?.comentarios ?? "");
    setEmailCopy(lead?.email_copy ?? "");
    setUltimo(lead?.ultimo_contacto ?? "");
    setProximo(lead?.proximo_contacto ?? "");
    setContactCount(lead?.contact_count ?? 0);
    setNote("");
    setNoteType("nota");
    setEmailSubject("");
    const preferred = lead?.comercial_id
      && senders.some((s) => s.userId === lead.comercial_id)
      ? lead.comercial_id
      : (senders[0]?.userId ?? DEFAULT_SENDER.userId);
    setSenderId(preferred);
  }, [open, lead?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- only hydrate when opening / changing lead

  const activeSender = senders.find((s) => s.userId === senderId) ?? senders[0] ?? DEFAULT_SENDER;

  useEffect(() => {
    if (!open || !lead?.id) {
      setActivities([]);
      return;
    }
    void (async () => {
      const { data, error } = await supabase
        .from("mc_crm_activities")
        .select("*")
        .eq("lead_id", lead.id)
        .order("scheduled_for", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) toast.error(error.message);
      else setActivities((data as CrmActivity[]) ?? []);
    })();
  }, [open, lead?.id]);

  const draftLead = useMemo(
    () => ({ nombre, empresa, gancho }),
    [nombre, empresa, gancho],
  );
  const resolvedEmail = emailCopy.trim() || defaultEmailCopy(draftLead);

  const payload = () => ({
    nombre,
    apellido,
    email,
    empresa,
    // CIF is edited at company level; keep existing / inherit from company defaults.
    cif: (lead?.cif ?? companyDefaults?.cif ?? null)?.toString().trim() || null,
    cargo: cargo || null,
    web: web || null,
    linkedin_url: linkedinUrl || null,
    region: region || null,
    comercial_id: comercialId || null,
    fase,
    // Keep existing DB value; A/B/C priorities are no longer edited in UI.
    prioridad: lead?.prioridad ?? "C",
    tipo_cuenta: tipoCuenta,
    plan_objetivo: planObjetivo,
    gancho: gancho || null,
    comentarios,
    email_copy: emailCopy || null,
    linkedin_copy: lead?.linkedin_copy ?? null,
    ultimo_contacto: ultimo || null,
    proximo_contacto: (fase === "perdido" || fase === "convertido") ? null : (proximo || null),
    contact_count: contactCount,
    is_converted: fase === "convertido",
    archived: lead?.archived ?? false,
    fuente: lead?.fuente ?? "manual",
  });

  const applyStatusOption = (option: CrmStatusOption) => {
    const fields = leadFieldsFromStatusOption(option, ultimo || null, [3, 7, 14], todayIso(), contactCount);
    setFase(fields.fase);
    setContactCount(fields.contact_count);
    if (fields.ultimo_contacto) setUltimo(fields.ultimo_contacto);
    setProximo(fields.proximo_contacto ?? "");
  };

  const onUltimoChange = (value: string) => {
    setUltimo(value);
    if (contactCount > 0) {
      setProximo(syncProximoFromUltimo(value, contactCount) ?? "");
    }
  };

  const save = async () => {
    if (!empresa.trim()) {
      toast.error(t("admin.crm.companyRequired"));
      return;
    }
    setSaving(true);
    try {
      if (lead?.id) {
        const { error } = await supabase.from("mc_crm_leads").update(payload()).eq("id", lead.id);
        if (error) throw error;
      } else {
        const insertComercial = !isSuperAdmin && currentUserId
          ? currentUserId
          : (comercialId || null);
        const { error } = await supabase.from("mc_crm_leads").insert({
          ...payload(),
          comercial_id: insertComercial,
          nombre: nombre || empresa,
        });
        if (error) throw error;
      }
      toast.success(fase === "convertido" ? t("admin.crm.leadConverted") : t("admin.crm.leadSaved"));
      await onSaved();
      if (!lead) onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.common.error"));
    } finally {
      setSaving(false);
    }
  };

  const scheduleFollowups = async () => {
    if (!lead?.id) {
      toast.error(t("admin.crm.saveBeforeFollowup"));
      return;
    }
    const { error } = await supabase.rpc("mc_crm_schedule_followups", {
      p_lead_id: lead.id,
      p_from: todayIso(),
    });
    if (error) toast.error(error.message);
    else {
      toast.success(t("admin.crm.followupsScheduled"));
      await onSaved();
      const { data } = await supabase.from("mc_crm_activities").select("*").eq("lead_id", lead.id).order("scheduled_for");
      setActivities((data as CrmActivity[]) ?? []);
    }
  };

  const addActivity = async (tipo = noteType, contenido = note, scheduledFor: string | null = null) => {
    if (!lead?.id) {
      toast.error(t("admin.crm.saveBeforeFollowup"));
      return;
    }
    if (!contenido.trim()) {
      toast.error(t("admin.crm.noteRequired"));
      return;
    }
    const { error } = await supabase.from("mc_crm_activities").insert({
      lead_id: lead.id,
      tipo,
      contenido: contenido.trim(),
      scheduled_for: scheduledFor,
    });
    if (error) toast.error(error.message);
    else {
      setNote("");
      toast.success(t("admin.crm.noteSaved"));
      const { data } = await supabase.from("mc_crm_activities").select("*").eq("lead_id", lead.id).order("scheduled_for");
      setActivities((data as CrmActivity[]) ?? []);
    }
  };

  const completeActivity = async (id: string) => {
    const { error } = await supabase
      .from("mc_crm_activities")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message);
    else setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, completed_at: new Date().toISOString() } : a)));
  };

  const statusOption = statusOptionFromLead(fase, contactCount);

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-[96vw] sm:max-w-[96vw] overflow-y-auto p-6 sm:p-8">
        <SheetHeader>
          <SheetTitle>{isNew ? t("admin.crm.newLead") : (empresa || t("admin.crm.editLead"))}</SheetTitle>
          <SheetDescription>
            {cargo || t("admin.crm.workbenchHint")}
          </SheetDescription>
        </SheetHeader>

        <Tabs value={workbenchTab} onValueChange={setWorkbenchTab} className="mt-4">
          <TabsList className={cn("grid w-full", canAccessEmail ? "grid-cols-3" : "grid-cols-2")}>
            <TabsTrigger value="ficha">{t("admin.crm.tabFicha")}</TabsTrigger>
            {canAccessEmail && (
              <TabsTrigger value="copys">{t("admin.crm.tabCopys")}</TabsTrigger>
            )}
            <TabsTrigger value="relacion">{t("admin.crm.tabRelacion")}</TabsTrigger>
          </TabsList>

          <TabsContent value="ficha" className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>{t("admin.common.company")}</Label>
              <Input value={empresa} onChange={(e) => setEmpresa(e.target.value)} />
              {(lead?.cif || companyDefaults?.cif) && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("admin.crm.cif")}: {(lead?.cif || companyDefaults?.cif || "").toString()}
                  {" · "}
                  {t("admin.crm.cifEditOnCompany")}
                </p>
              )}
            </div>
            <div>
              <Label>{t("admin.common.name")}</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div>
              <Label>{t("admin.crm.lastName")}</Label>
              <Input value={apellido} onChange={(e) => setApellido(e.target.value)} />
            </div>
            <div>
              <Label>{t("admin.crm.roleTitle")}</Label>
              <Input value={cargo} onChange={(e) => setCargo(e.target.value)} />
            </div>
            <div>
              <Label>{t("admin.common.email")}</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Web</Label>
              <Input value={web} onChange={(e) => setWeb(e.target.value)} />
            </div>
            <div>
              <Label>LinkedIn</Label>
              <Input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} />
            </div>
            <div>
              <Label>{t("admin.crm.region")}</Label>
              <Input value={region} onChange={(e) => setRegion(e.target.value)} />
            </div>
            <div>
              <Label>{t("admin.crm.accountType")}</Label>
              <Select value={tipoCuenta} onValueChange={(v) => setTipoCuenta(v as typeof tipoCuenta)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CRM_ACCOUNT_TYPES.map((k) => (
                    <SelectItem key={k} value={k}>{t(`admin.crm.accountTypes.${k}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("admin.crm.planTarget")}</Label>
              <Select value={planObjetivo} onValueChange={(v) => setPlanObjetivo(v as typeof planObjetivo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CRM_PLAN_TARGETS.map((k) => (
                    <SelectItem key={k} value={k}>{k}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("admin.crm.phase")}</Label>
              <Select
                value={statusOption}
                onValueChange={(v) => applyStatusOption(v as CrmStatusOption)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CRM_STATUS_OPTIONS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {k.startsWith("contactado_")
                        ? t("admin.crm.statusContactedN", { n: k.slice(-1) })
                        : t(`admin.leadPhases.${k}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("admin.crm.commercial")}</Label>
              <Select value={comercialId} onValueChange={setComercialId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {commercialStaff.map((s) => (
                    <SelectItem key={s.user_id} value={s.user_id}>{s.full_name ?? s.user_id.slice(0, 8)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("admin.crm.colLastContact")}</Label>
              <Input type="date" value={ultimo} onChange={(e) => onUltimoChange(e.target.value)} />
            </div>
            {fase !== "perdido" && fase !== "convertido" && (
              <div>
                <Label>{t("admin.crm.colNextContact")}</Label>
                <Input type="date" value={proximo} onChange={(e) => setProximo(e.target.value)} />
              </div>
            )}
            <div className="sm:col-span-2">
              <Label>{t("admin.crm.hook")}</Label>
              <Textarea value={gancho} onChange={(e) => setGancho(e.target.value)} rows={3} />
            </div>
            <div className="sm:col-span-2">
              <Label>{t("admin.crm.comments")}</Label>
              <Textarea value={comentarios} onChange={(e) => setComentarios(e.target.value)} rows={3} />
            </div>
          </TabsContent>

          {canAccessEmail && (
            <TabsContent value="copys" className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">{t("admin.crm.emailNoSendHint")}</p>
              <div className="rounded-md border p-3 space-y-3 bg-muted/20">
                <div className="space-y-1.5">
                  <Label>{t("admin.crm.senderLabel")}</Label>
                  <Select value={activeSender.userId} onValueChange={setSenderId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {senders.map((s) => (
                        <SelectItem key={s.userId} value={s.userId}>
                          {s.fullName} · {s.workEmail}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground whitespace-pre-line line-clamp-4">
                    {[activeSender.fullName, activeSender.jobTitle, activeSender.workEmail].filter(Boolean).join("\n")}
                  </p>
                </div>
                {contactCount > 0 && fase !== "perdido" && fase !== "convertido" && (
                  <p className="text-xs text-muted-foreground">
                    {t("admin.crm.outreachContactStatus", {
                      count: contactCount,
                      next: proximo || "—",
                    })}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {web && (
                  <Button variant="outline" size="sm" className="gap-1" asChild>
                    <a href={web} target="_blank" rel="noreferrer">
                      <ExternalLink className="w-3.5 h-3.5" /> Web
                    </a>
                  </Button>
                )}
              </div>
              <div>
                <Label>{t("admin.crm.agente.subject")}</Label>
                <Input
                  className="mt-1"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder={t("admin.crm.emailSubjectPlaceholder")}
                />
              </div>
              <div>
                <Label className="mb-1 block">{t("admin.crm.emailCopy")}</Label>
                <Textarea
                  className="min-h-[160px] text-sm"
                  value={emailCopy.trim() ? emailCopy : resolvedEmail}
                  onChange={(e) => setEmailCopy(e.target.value)}
                />
              </div>
            </TabsContent>
          )}

          <TabsContent value="relacion" className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void scheduleFollowups()}>{t("admin.crm.schedule3714")}</Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void addActivity("post_demo", defaultPostDemoNote({ empresa }), todayIso())}
              >
                {t("admin.crm.addPostDemo")}
              </Button>
            </div>
            <div className="space-y-2">
              <Label>{t("admin.crm.newNote")}</Label>
              <Select value={noteType} onValueChange={(v) => setNoteType(v as typeof noteType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CRM_ACTIVITY_TYPES.map((k) => (
                    <SelectItem key={k} value={k}>{t(`admin.crm.activityTypes.${k}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
              <Button size="sm" className="gap-1" onClick={() => void addActivity()}>
                <Plus className="w-3.5 h-3.5" /> {t("admin.crm.addNote")}
              </Button>
            </div>
            <div className="space-y-2">
              {activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("admin.crm.noActivities")}</p>
              ) : activities.map((a) => (
                <div key={a.id} className="rounded-md border p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{t(`admin.crm.activityTypes.${a.tipo}`)}</Badge>
                      {a.scheduled_for && (
                        <span className="text-xs text-muted-foreground">{a.scheduled_for}</span>
                      )}
                    </div>
                    {a.completed_at ? (
                      <span className="text-xs text-emerald-600">{t("admin.crm.done")}</span>
                    ) : (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void completeActivity(a.id)}>
                        <Check className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{a.contenido}</p>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <SheetFooter className="mt-6">
          <Button type="button" variant="outline" onClick={onClose}>{t("admin.common.cancel")}</Button>
          <Button type="button" onClick={() => void save()} disabled={saving} className="gap-1">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("admin.common.save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
