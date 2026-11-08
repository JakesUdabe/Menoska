"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2, Plus, Search, UserCog, UserMinus, Shield,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useLocale } from "@/i18n/provider";
import { withLocale } from "@/lib/paths";
import { supabase } from "@/lib/supabase/browser";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  EMPTY_EMPLOYEE_PERMISSIONS,
  EMPLOYEE_ASSIGNABLE_PERMISSIONS,
  getDefaultAdminRoute,
  isSuperAdmin,
  normalizeEmployeePermissions,
  type EmployeePermissionKey,
} from "@/lib/admin/rbac";
import { cn } from "@/lib/utils";

interface EmployeeRow {
  user_id: string;
  full_name: string | null;
  company_name: string | null;
  email: string;
  role: string;
  employee_permissions: Record<string, unknown>;
  created_at: string;
  job_title: string | null;
  work_email: string | null;
  calendly_url: string | null;
}

interface CandidateHit {
  user_id: string;
  full_name: string | null;
  company_name: string | null;
  email: string;
  role: string;
}

function displayName(row: { full_name: string | null; email: string; company_name: string | null }) {
  return row.full_name?.trim() || row.email || row.company_name || "—";
}

export default function AdminEmpleadosPage() {
  const { t } = useTranslation();
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { locale } = useLocale();
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<CandidateHit[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateHit | null>(null);
  const [newPerms, setNewPerms] = useState({ ...EMPTY_EMPLOYEE_PERMISSIONS });
  const [adding, setAdding] = useState(false);

  const canManage = isSuperAdmin(profile?.role);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("mc_list_employee_profiles");
    if (error) toast.error(error.message);
    else setEmployees((data as EmployeeRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!canManage) return;
    void fetchEmployees();
  }, [canManage, fetchEmployees]);

  useEffect(() => {
    if (!showAdd || !canManage) return;
    const q = searchQ.trim();
    if (q.length < 2) {
      setCandidates([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      const { data, error } = await supabase.rpc("mc_search_users_for_employee", {
        p_query: q,
        p_limit: 12,
      });
      if (error) toast.error(error.message);
      else setCandidates((data as CandidateHit[]) ?? []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQ, showAdd, canManage]);

  const permissionLabel = (key: EmployeePermissionKey) =>
    t(`admin.empleados.permissions.${key}`);

  const enabledCount = useMemo(
    () => (perms: Record<string, unknown>) =>
      EMPLOYEE_ASSIGNABLE_PERMISSIONS.filter(
        (k) => normalizeEmployeePermissions(perms)[k],
      ).length,
    [],
  );

  useEffect(() => {
    if (authLoading || canManage) return;
    router.replace(withLocale(locale, getDefaultAdminRoute(profile ?? undefined)));
  }, [authLoading, canManage, locale, profile, router]);

  if (authLoading || !canManage) {
    return null;
  }

  const updatePerm = async (
    employee: EmployeeRow,
    key: EmployeePermissionKey,
    value: boolean,
  ) => {
    const next = {
      ...normalizeEmployeePermissions(employee.employee_permissions),
      [key]: value,
    };
    setSavingId(employee.user_id);
    setEmployees((prev) =>
      prev.map((e) =>
        e.user_id === employee.user_id
          ? { ...e, employee_permissions: next }
          : e,
      ),
    );
    const { error } = await supabase.rpc("mc_update_employee_permissions", {
      p_user_id: employee.user_id,
      p_permissions: next,
    });
    setSavingId(null);
    if (error) {
      toast.error(error.message);
      await fetchEmployees();
    } else {
      toast.success(t("admin.empleados.permissionsSaved"));
    }
  };

  const saveCommercialIdentity = async (
    employee: EmployeeRow,
    fullName: string,
    jobTitle: string,
    workEmail: string,
    calendlyUrl: string,
  ) => {
    setSavingId(employee.user_id);
    const { error } = await supabase.rpc("mc_update_employee_commercial_identity", {
      p_user_id: employee.user_id,
      p_full_name: fullName,
      p_job_title: jobTitle,
      p_work_email: workEmail,
      p_calendly_url: calendlyUrl,
    });
    setSavingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEmployees((prev) =>
      prev.map((e) =>
        e.user_id === employee.user_id
          ? {
              ...e,
              full_name: fullName.trim() || null,
              job_title: jobTitle.trim() || null,
              work_email: workEmail.trim().toLowerCase() || null,
              calendly_url: calendlyUrl.trim() || null,
            }
          : e,
      ),
    );
    toast.success(t("admin.empleados.commercialSaved"));
  };

  const demote = async (employee: EmployeeRow) => {
    if (!window.confirm(t("admin.empleados.demoteConfirm", { name: displayName(employee) }))) {
      return;
    }
    setSavingId(employee.user_id);
    const { error } = await supabase.rpc("mc_demote_employee_to_client", {
      p_user_id: employee.user_id,
    });
    setSavingId(null);
    if (error) toast.error(error.message);
    else {
      toast.success(t("admin.empleados.demoted"));
      await fetchEmployees();
    }
  };

  const addEmployee = async () => {
    if (!selectedCandidate) return;
    setAdding(true);
    const { error } = await supabase.rpc("mc_set_user_as_employee", {
      p_user_id: selectedCandidate.user_id,
      p_permissions: newPerms,
    });
    setAdding(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("admin.empleados.added"));
    setShowAdd(false);
    setSearchQ("");
    setCandidates([]);
    setSelectedCandidate(null);
    setNewPerms({ ...EMPTY_EMPLOYEE_PERMISSIONS });
    await fetchEmployees();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">
            {t("admin.empleados.title")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t("admin.empleados.subtitle")}
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1"
          onClick={() => {
            setShowAdd(true);
            setSelectedCandidate(null);
            setSearchQ("");
            setCandidates([]);
            setNewPerms({ ...EMPTY_EMPLOYEE_PERMISSIONS });
          }}
        >
          <Plus className="w-4 h-4" /> {t("admin.empleados.add")}
        </Button>
      </div>

      {employees.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            <UserCog className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>{t("admin.empleados.empty")}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setShowAdd(true)}
            >
              {t("admin.empleados.createFirst")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {employees.map((emp) => {
            const isAdmin = isSuperAdmin(emp.role);
            const perms = normalizeEmployeePermissions(emp.employee_permissions);
            const busy = savingId === emp.user_id;
            return (
              <Card key={emp.user_id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                        {displayName(emp)}
                        <Badge variant="secondary" className="font-normal">
                          {isAdmin ? t("admin.roles.admin") : t("admin.roles.empleado")}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {[emp.email, emp.company_name].filter(Boolean).join(" · ") || emp.user_id}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="gap-1 font-normal">
                        <Shield className="w-3 h-3" />
                        {isAdmin
                          ? t("admin.empleados.fullAccess")
                          : t("admin.empleados.enabledCount", { count: enabledCount(emp.employee_permissions) })}
                      </Badge>
                      {!isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive gap-1"
                          disabled={busy}
                          onClick={() => void demote(emp)}
                        >
                          <UserMinus className="w-4 h-4" />
                          {t("admin.empleados.demote")}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <EmployeeCommercialFields
                    employee={emp}
                    busy={busy}
                    onSave={(fullName, jobTitle, workEmail, calendlyUrl) =>
                      void saveCommercialIdentity(emp, fullName, jobTitle, workEmail, calendlyUrl)
                    }
                  />
                  {isAdmin ? (
                    <p className="text-xs text-muted-foreground rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                      {t("admin.empleados.superadminPermissionsLocked")}
                    </p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {EMPLOYEE_ASSIGNABLE_PERMISSIONS.map((key) => (
                        <label
                          key={key}
                          className={cn(
                            "flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5",
                            busy && "opacity-60",
                          )}
                        >
                          <span className="text-sm">{permissionLabel(key)}</span>
                          <Switch
                            checked={perms[key]}
                            disabled={busy}
                            onCheckedChange={(v) => void updatePerm(emp, key, v)}
                          />
                        </label>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("admin.empleados.addTitle")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("admin.empleados.searchUser")}</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={searchQ}
                  onChange={(e) => {
                    setSearchQ(e.target.value);
                    setSelectedCandidate(null);
                  }}
                  placeholder={t("admin.empleados.searchPlaceholder")}
                />
              </div>
              {searching && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> {t("admin.empleados.searching")}
                </p>
              )}
              {!selectedCandidate && candidates.length > 0 && (
                <ul className="border border-border rounded-lg divide-y max-h-48 overflow-y-auto">
                  {candidates.map((c) => (
                    <li key={c.user_id}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition-colors"
                        onClick={() => {
                          setSelectedCandidate(c);
                          setSearchQ(displayName(c));
                          setCandidates([]);
                        }}
                      >
                        <span className="font-medium">{displayName(c)}</span>
                        <span className="block text-xs text-muted-foreground">
                          {[c.email, c.company_name, c.role].filter(Boolean).join(" · ")}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {selectedCandidate && (
                <p className="text-sm rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
                  {t("admin.empleados.selected")}:{" "}
                  <strong>{displayName(selectedCandidate)}</strong>
                  {selectedCandidate.email ? ` (${selectedCandidate.email})` : ""}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t("admin.empleados.initialPermissions")}</Label>
              <div className="grid gap-2">
                {EMPLOYEE_ASSIGNABLE_PERMISSIONS.map((key) => (
                  <label
                    key={key}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                  >
                    <span className="text-sm">{permissionLabel(key)}</span>
                    <Switch
                      checked={newPerms[key]}
                      onCheckedChange={(v) =>
                        setNewPerms((prev) => ({ ...prev, [key]: v }))
                      }
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>
              {t("admin.common.cancel")}
            </Button>
            <Button
              disabled={!selectedCandidate || adding}
              onClick={() => void addEmployee()}
            >
              {adding && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              {t("admin.empleados.confirmAdd")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmployeeCommercialFields({
  employee,
  busy,
  onSave,
}: {
  employee: EmployeeRow;
  busy: boolean;
  onSave: (fullName: string, jobTitle: string, workEmail: string, calendlyUrl: string) => void;
}) {
  const { t } = useTranslation();
  const [fullName, setFullName] = useState(employee.full_name ?? "");
  const [jobTitle, setJobTitle] = useState(employee.job_title ?? "");
  const [workEmail, setWorkEmail] = useState(employee.work_email ?? employee.email ?? "");
  const [calendlyUrl, setCalendlyUrl] = useState(employee.calendly_url ?? "");

  useEffect(() => {
    setFullName(employee.full_name ?? "");
    setJobTitle(employee.job_title ?? "");
    setWorkEmail(employee.work_email ?? employee.email ?? "");
    setCalendlyUrl(employee.calendly_url ?? "");
  }, [employee.full_name, employee.job_title, employee.work_email, employee.email, employee.calendly_url]);

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <p className="text-sm font-medium">{t("admin.empleados.commercialTitle")}</p>
      <p className="text-xs text-muted-foreground">{t("admin.empleados.commercialDesc")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>{t("admin.empleados.fullName")}</Label>
          <Input
            value={fullName}
            disabled={busy}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t("admin.empleados.fullNamePlaceholder")}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t("admin.empleados.jobTitle")}</Label>
          <Input
            value={jobTitle}
            disabled={busy}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="Director Comercial"
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t("admin.empleados.workEmail")}</Label>
          <Input
            type="email"
            value={workEmail}
            disabled={busy}
            onChange={(e) => setWorkEmail(e.target.value)}
            placeholder="nombre@proposalyze.com"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>{t("admin.empleados.calendlyUrl")}</Label>
          <Input
            type="url"
            value={calendlyUrl}
            disabled={busy}
            onChange={(e) => setCalendlyUrl(e.target.value)}
            placeholder="https://cal.com/nombre/demo"
          />
          <p className="text-xs text-muted-foreground">{t("admin.empleados.calendlyUrlHint")}</p>
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => onSave(fullName, jobTitle, workEmail, calendlyUrl)}
      >
        {t("admin.empleados.saveCommercial")}
      </Button>
    </div>
  );
}
