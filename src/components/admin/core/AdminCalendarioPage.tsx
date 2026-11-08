"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock, Play, Square, CalendarDays, TrendingUp, Users,
  Plus, Pencil, Trash2, Loader2, Check, X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/browser";
import { useAuth } from "@/components/auth-provider";
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
import { cn } from "@/lib/utils";
import {
  computeDailyHours, computeWeeklyHours, computeExpectedWeekly,
  entryDurationHours, formatHours, getWeekdayDates, dateKey,
  getYear, yearDays, dateInRange,
} from "@/lib/admin/time-utils";
import { useStaffProfiles, useTargetUserId } from "@/lib/admin/use-admin-data";
import { isSuperAdmin } from "@/lib/admin/rbac";
import type { AbsenceRequest, AbsenceType, Festivo, TimeEntry } from "@/lib/admin/types";
import {
  ABSENCE_COLORS, EXPECTED_DAILY_HOURS,
} from "@/lib/admin/types";

const FESTIVO_COLOR = "bg-sky-600";
import { format, parseISO } from "date-fns";
import { es, enUS, eu, gl, ca } from "date-fns/locale";
import type { Locale } from "date-fns";

const ABSENCE_TYPES: AbsenceType[] = ["vacation", "sick_leave", "maternity", "justified", "pending"];
const ADMIN_ABSENCE_TYPES: AbsenceType[] = ["sick_leave", "maternity", "justified", "vacation"];
const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

function getDateFnsLocale(lang: string): Locale {
  switch (lang.split("-")[0]) {
    case "en": return enUS;
    case "eu": return eu;
    case "gl": return gl;
    case "ca": return ca;
    default: return es;
  }
}

export default function AdminCalendarioPage() {
  const { t, i18n } = useTranslation();
  const { user, profile } = useAuth();
  const { effectiveUserId, selectedUserId, setSelectedUserId, isAdmin } = useTargetUserId();
  const staffProfiles = useStaffProfiles();
  const dateLocale = useMemo(() => getDateFnsLocale(i18n.language), [i18n.language]);
  const emDash = t("admin.convocatoriasPage.emDash");

  const formatLocalDate = useCallback(
    (date: Date | string, pattern = "dd MMM yyyy") => {
      const d = typeof date === "string" ? parseISO(date) : date;
      return format(d, pattern, { locale: dateLocale });
    },
    [dateLocale],
  );

  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [absences, setAbsences] = useState<AbsenceRequest[]>([]);
  const [festivos, setFestivos] = useState<Festivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [clockLoading, setClockLoading] = useState(false);
  const [calendarYear, setCalendarYear] = useState(getYear(new Date()));
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null);
  const [showAbsenceDialog, setShowAbsenceDialog] = useState(false);
  const [showAdminAbsenceDialog, setShowAdminAbsenceDialog] = useState(false);
  const [showFestivoDialog, setShowFestivoDialog] = useState(false);
  const [editFestivo, setEditFestivo] = useState<Festivo | null>(null);

  const activeEntry = useMemo(
    () => entries.find((e) => !e.clock_out && e.user_id === effectiveUserId),
    [entries, effectiveUserId],
  );

  const holidayDates = useMemo(() => festivos.map((f) => f.fecha), [festivos]);
  const today = new Date();
  const weekdays = getWeekdayDates(today, holidayDates);
  const dailyHours = computeDailyHours(entries, today);
  const weeklyHours = computeWeeklyHours(entries, today, holidayDates);
  const expectedWeekly = computeExpectedWeekly(today, holidayDates);
  const isTodayHoliday = holidayDates.includes(dateKey(today));
  const expectedDaily = isTodayHoliday ? 0 : EXPECTED_DAILY_HOURS;

  const fetchData = useCallback(async () => {
    if (!effectiveUserId && !isAdmin) return;
    setLoading(true);
    try {
      let entryQuery = supabase
        .from("mc_time_entries")
        .select("*")
        .order("work_date", { ascending: false })
        .limit(100);

      if (!isAdmin) {
        entryQuery = entryQuery.eq("user_id", effectiveUserId!);
      } else if (selectedUserId) {
        entryQuery = entryQuery.eq("user_id", selectedUserId);
      }

      let absenceQuery = supabase
        .from("mc_absence_requests")
        .select("*")
        .order("start_date", { ascending: false });

      if (!isAdmin) {
        absenceQuery = absenceQuery.eq("user_id", effectiveUserId!);
      }

      const festivoQuery = supabase
        .from("mc_festivos")
        .select("*")
        .order("fecha", { ascending: true });

      const [entryRes, absenceRes, festivoRes] = await Promise.all([
        entryQuery, absenceQuery, festivoQuery,
      ]);
      if (entryRes.error) throw entryRes.error;
      if (absenceRes.error) throw absenceRes.error;
      if (festivoRes.error) throw festivoRes.error;
      setEntries((entryRes.data as TimeEntry[]) ?? []);
      setAbsences((absenceRes.data as AbsenceRequest[]) ?? []);
      setFestivos((festivoRes.data as Festivo[]) ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.calendario.loadError"));
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId, isAdmin, selectedUserId, t]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const handleClockToggle = async () => {
    if (!user?.id) return;
    setClockLoading(true);
    try {
      if (activeEntry) {
        const { error } = await supabase
          .from("mc_time_entries")
          .update({ clock_out: new Date().toISOString() })
          .eq("id", activeEntry.id);
        if (error) throw error;
        toast.success(t("admin.calendario.shiftEnded"));
      } else {
        const now = new Date();
        const { error } = await supabase.from("mc_time_entries").insert({
          user_id: user.id,
          work_date: format(now, "yyyy-MM-dd"),
          clock_in: now.toISOString(),
        });
        if (error) throw error;
        toast.success(t("admin.calendario.shiftStarted"));
      }
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.calendario.clockError"));
    } finally {
      setClockLoading(false);
    }
  };

  const saveEntry = async (data: Partial<TimeEntry> & { id?: string }) => {
    try {
      if (data.id) {
        const { error } = await supabase.from("mc_time_entries").update({
          work_date: data.work_date,
          clock_in: data.clock_in,
          clock_out: data.clock_out,
          notes: data.notes,
        }).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("mc_time_entries").insert({
          user_id: user!.id,
          work_date: data.work_date!,
          clock_in: data.clock_in!,
          clock_out: data.clock_out,
          notes: data.notes,
        });
        if (error) throw error;
      }
      toast.success(t("admin.calendario.entrySaved"));
      setEditEntry(null);
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.calendario.saveError"));
    }
  };

  const deleteEntry = async (id: string) => {
    const { error } = await supabase.from("mc_time_entries").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(t("admin.common.deleted")); await fetchData(); }
  };

  const requestAbsence = async (form: {
    start_date: string; end_date: string; notes: string;
  }) => {
    const { error } = await supabase.from("mc_absence_requests").insert({
      user_id: user!.id,
      start_date: form.start_date,
      end_date: form.end_date,
      absence_type: "pending",
      status: "pending",
      notes: form.notes,
      created_by: user!.id,
    });
    if (error) toast.error(error.message);
    else { toast.success(t("admin.calendario.requestSent")); setShowAbsenceDialog(false); await fetchData(); }
  };

  const adminCreateAbsence = async (form: {
    user_id: string; start_date: string; end_date: string;
    absence_type: AbsenceType; notes: string;
  }) => {
    const { error } = await supabase.from("mc_absence_requests").insert({
      user_id: form.user_id,
      start_date: form.start_date,
      end_date: form.end_date,
      absence_type: form.absence_type,
      status: "approved",
      notes: form.notes,
      created_by: user!.id,
      approved_by: user!.id,
    });
    if (error) toast.error(error.message);
    else { toast.success(t("admin.calendario.eventRegistered")); setShowAdminAbsenceDialog(false); await fetchData(); }
  };

  const reviewAbsence = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("mc_absence_requests").update({
      status,
      approved_by: user!.id,
      absence_type: status === "approved" ? "vacation" : "pending",
    }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(status === "approved" ? t("admin.calendario.approved") : t("admin.calendario.rejected"));
      await fetchData();
    }
  };

  const yearFestivos = useMemo(
    () => festivos.filter((f) => f.fecha.startsWith(String(calendarYear))),
    [festivos, calendarYear],
  );

  const saveFestivo = async (data: { id?: string; fecha: string; nombre: string }) => {
    try {
      if (data.id) {
        const { error } = await supabase.from("mc_festivos").update({
          fecha: data.fecha,
          nombre: data.nombre,
        }).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("mc_festivos").insert({
          fecha: data.fecha,
          nombre: data.nombre,
          created_by: user!.id,
        });
        if (error) throw error;
      }
      toast.success(t("admin.calendario.festivoSaved"));
      setShowFestivoDialog(false);
      setEditFestivo(null);
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.calendario.saveError"));
    }
  };

  const deleteFestivo = async (id: string) => {
    const { error } = await supabase.from("mc_festivos").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(t("admin.common.deleted")); await fetchData(); }
  };

  const pendingAbsences = absences.filter((a) => a.status === "pending");

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">{t("admin.calendario.title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t("admin.calendario.subtitle")}
          </p>
        </div>
        {isAdmin && (
          <Select value={selectedUserId ?? ""} onValueChange={setSelectedUserId}>
            <SelectTrigger className="w-[220px]">
              <Users className="w-4 h-4 mr-2" />
              <SelectValue placeholder={t("admin.calendario.viewEmployee")} />
            </SelectTrigger>
            <SelectContent>
              {staffProfiles.map((p) => (
                <SelectItem key={p.user_id} value={p.user_id}>
                  {p.full_name ?? p.user_id.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Clock}
          label={t("admin.calendario.today")}
          value={formatHours(dailyHours)}
          sub={t("admin.calendario.target", { hours: expectedDaily })}
          progress={expectedDaily > 0 ? (dailyHours / expectedDaily) * 100 : 0}
        />
        <KpiCard
          icon={TrendingUp}
          label={t("admin.calendario.week")}
          value={formatHours(weeklyHours)}
          sub={t("admin.calendario.target", { hours: expectedWeekly })}
          progress={expectedWeekly > 0 ? (weeklyHours / expectedWeekly) * 100 : 0}
        />
        {weekdays.map((day) => (
          <KpiCard
            key={day.toISOString()}
            icon={CalendarDays}
            label={formatLocalDate(day, "EEE dd")}
            value={formatHours(computeDailyHours(entries, day))}
            sub={t("admin.calendario.perDay", { hours: EXPECTED_DAILY_HOURS })}
            progress={(computeDailyHours(entries, day) / EXPECTED_DAILY_HOURS) * 100}
            compact
          />
        ))}
      </div>

      {(!isAdmin || selectedUserId === user?.id) && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6">
            <div>
              <p className="font-semibold">
                {activeEntry ? t("admin.calendario.activeShift") : t("admin.calendario.noClock")}
              </p>
              {activeEntry && (
                <p className="text-sm text-muted-foreground">
                  {t("admin.calendario.clockIn", { time: formatLocalDate(activeEntry.clock_in, "HH:mm") })}
                </p>
              )}
            </div>
            <Button
              size="lg"
              variant={activeEntry ? "destructive" : "default"}
              onClick={handleClockToggle}
              disabled={clockLoading}
              className="gap-2 min-w-[180px]"
            >
              {clockLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : activeEntry ? (
                <><Square className="w-4 h-4" /> {t("admin.calendario.endShift")}</>
              ) : (
                <><Play className="w-4 h-4" /> {t("admin.calendario.startShift")}</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="registros">
        <TabsList>
          <TabsTrigger value="registros">{t("admin.calendario.tabEntries")}</TabsTrigger>
          <TabsTrigger value="calendario">{t("admin.calendario.tabCalendar")}</TabsTrigger>
          {isSuperAdmin(profile?.role) && (
            <TabsTrigger value="festivos">
              {t("admin.calendario.tabFestivos")}
              {yearFestivos.length > 0 && (
                <Badge variant="secondary" className="ml-2">{yearFestivos.length}</Badge>
              )}
            </TabsTrigger>
          )}
          {isSuperAdmin(profile?.role) && (
            <TabsTrigger value="aprobaciones">
              {t("admin.calendario.tabApprovals")}
              {pendingAbsences.length > 0 && (
                <Badge variant="secondary" className="ml-2">{pendingAbsences.length}</Badge>
              )}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="registros" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t("admin.calendario.historyTitle")}</CardTitle>
                <CardDescription>{t("admin.calendario.historyDesc")}</CardDescription>
              </div>
              <Button size="sm" onClick={() => setEditEntry({} as TimeEntry)} className="gap-1">
                <Plus className="w-4 h-4" /> {t("admin.calendario.add")}
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.calendario.colDate")}</TableHead>
                      <TableHead>{t("admin.calendario.colIn")}</TableHead>
                      <TableHead>{t("admin.calendario.colOut")}</TableHead>
                      <TableHead>{t("admin.calendario.colTotal")}</TableHead>
                      <TableHead>{t("admin.calendario.colNotes")}</TableHead>
                      <TableHead className="w-[80px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>{formatLocalDate(e.work_date)}</TableCell>
                        <TableCell>{formatLocalDate(e.clock_in, "HH:mm")}</TableCell>
                        <TableCell>{e.clock_out ? formatLocalDate(e.clock_out, "HH:mm") : emDash}</TableCell>
                        <TableCell>{formatHours(entryDurationHours(e))}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{e.notes ?? emDash}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setEditEntry(e)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteEntry(e.id)}>
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendario" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCalendarYear((y) => y - 1)}>←</Button>
              <span className="font-semibold text-lg">{calendarYear}</span>
              <Button variant="outline" size="sm" onClick={() => setCalendarYear((y) => y + 1)}>→</Button>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowAbsenceDialog(true)}>
                {t("admin.calendario.requestVacation")}
              </Button>
              {isSuperAdmin(profile?.role) && (
                <Button size="sm" onClick={() => setShowAdminAbsenceDialog(true)}>
                  {t("admin.calendario.registerEvent")}
                </Button>
              )}
            </div>
          </div>
          <AnnualCalendar
            year={calendarYear}
            absences={absences}
            festivos={festivos}
            dateLocale={dateLocale}
          />
        </TabsContent>

        {isSuperAdmin(profile?.role) && (
          <TabsContent value="festivos" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{t("admin.calendario.festivosTitle", { year: calendarYear })}</CardTitle>
                  <CardDescription>{t("admin.calendario.festivosDesc")}</CardDescription>
                </div>
                <Button
                  size="sm"
                  className="gap-1"
                  onClick={() => { setEditFestivo(null); setShowFestivoDialog(true); }}
                >
                  <Plus className="w-4 h-4" /> {t("admin.calendario.addFestivo")}
                </Button>
              </CardHeader>
              <CardContent>
                {yearFestivos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("admin.calendario.noFestivos")}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("admin.calendario.colDate")}</TableHead>
                        <TableHead>{t("admin.common.title")}</TableHead>
                        <TableHead className="w-[80px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {yearFestivos.map((f) => (
                        <TableRow key={f.id}>
                          <TableCell>{formatLocalDate(f.fecha)}</TableCell>
                          <TableCell>{f.nombre}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => { setEditFestivo(f); setShowFestivoDialog(true); }}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => deleteFestivo(f.id)}>
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isSuperAdmin(profile?.role) && (
          <TabsContent value="aprobaciones" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("admin.calendario.pendingTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingAbsences.length === 0 ? (
                  <p className="text-muted-foreground text-sm">{t("admin.calendario.noPending")}</p>
                ) : (
                  pendingAbsences.map((a) => (
                    <div key={a.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                      <div>
                        <p className="font-medium">
                          {formatLocalDate(a.start_date)} — {formatLocalDate(a.end_date)}
                        </p>
                        <p className="text-sm text-muted-foreground">{a.notes}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => reviewAbsence(a.id, "approved")}>
                          <Check className="w-4 h-4" /> {t("admin.calendario.approve")}
                        </Button>
                        <Button size="sm" variant="destructive" className="gap-1" onClick={() => reviewAbsence(a.id, "rejected")}>
                          <X className="w-4 h-4" /> {t("admin.calendario.reject")}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {editEntry !== null && (
        <TimeEntryDialog
          entry={editEntry.id ? editEntry : null}
          onClose={() => setEditEntry(null)}
          onSave={saveEntry}
        />
      )}
      {showAbsenceDialog && (
        <AbsenceRequestDialog onClose={() => setShowAbsenceDialog(false)} onSubmit={requestAbsence} />
      )}
      {showAdminAbsenceDialog && (
        <AdminAbsenceDialog
          staff={staffProfiles}
          onClose={() => setShowAdminAbsenceDialog(false)}
          onSubmit={adminCreateAbsence}
        />
      )}
      {showFestivoDialog && (
        <FestivoDialog
          festivo={editFestivo}
          defaultYear={calendarYear}
          onClose={() => { setShowFestivoDialog(false); setEditFestivo(null); }}
          onSave={saveFestivo}
        />
      )}
    </div>
  );
}

function KpiCard({
  icon: Icon, label, value, sub, progress, compact,
}: {
  icon: typeof Clock; label: string; value: string; sub: string;
  progress: number; compact?: boolean;
}) {
  return (
    <Card className={cn(compact && "hidden lg:block")}>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <Icon className="w-4 h-4" />
          <span className="text-xs uppercase tracking-wide">{label}</span>
        </div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
        <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function AnnualCalendar({
  year, absences, festivos, dateLocale,
}: {
  year: number;
  absences: AbsenceRequest[];
  festivos: Festivo[];
  dateLocale: Locale;
}) {
  const { t } = useTranslation();
  const months = Array.from({ length: 12 }, (_, i) => i);
  const days = yearDays(year);
  const weekdayLabels = WEEKDAY_KEYS.map((key) =>
    t(`admin.calendario.weekdaysShort.${key}`),
  );
  const festivoByDate = useMemo(() => {
    const map = new Map<string, Festivo>();
    for (const f of festivos) map.set(f.fecha, f);
    return map;
  }, [festivos]);

  const getDayColor = (day: Date): string | null => {
    const festivo = festivoByDate.get(dateKey(day));
    if (festivo) return FESTIVO_COLOR;
    for (const a of absences) {
      if (!dateInRange(day, a.start_date, a.end_date)) continue;
      if (a.status === "pending") return ABSENCE_COLORS.pending;
      const type = a.status === "approved" ? (a.absence_type === "pending" ? "vacation" : a.absence_type) : null;
      if (type && type in ABSENCE_COLORS) return ABSENCE_COLORS[type as AbsenceType];
    }
    return null;
  };

  const getDayTitle = (day: Date): string => {
    const festivo = festivoByDate.get(dateKey(day));
    const base = format(day, "dd/MM/yyyy");
    return festivo ? `${base} — ${festivo.nombre}` : base;
  };

  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {months.map((month) => {
        const monthDays = days.filter((d) => d.getMonth() === month);
        return (
          <Card key={month}>
            <CardHeader className="py-3">
              <CardTitle className="text-sm capitalize">
                {format(new Date(year, month, 1), "MMMM yyyy", { locale: dateLocale })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 text-center text-[10px]">
                {weekdayLabels.map((d) => (
                  <span key={d} className="text-muted-foreground font-medium">{d}</span>
                ))}
                {Array.from({ length: (monthDays[0].getDay() + 6) % 7 }).map((_, i) => (
                  <span key={`pad-${i}`} />
                ))}
                {monthDays.map((day) => {
                  const color = getDayColor(day);
                  return (
                    <span
                      key={day.toISOString()}
                      title={getDayTitle(day)}
                      className={cn(
                        "aspect-square flex items-center justify-center rounded-sm text-[10px]",
                        color ?? "hover:bg-muted",
                        color && "text-white font-medium",
                      )}
                    >
                      {day.getDate()}
                    </span>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
      <div className="md:col-span-2 xl:col-span-3 flex flex-wrap gap-3 text-xs">
        <span className="flex items-center gap-1.5">
          <span className={cn("w-3 h-3 rounded-sm", FESTIVO_COLOR)} />
          {t("admin.calendario.festivoLegend")}
        </span>
        {ABSENCE_TYPES.map((key) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className={cn("w-3 h-3 rounded-sm", ABSENCE_COLORS[key])} />
            {t(`admin.absenceTypes.${key}`)}
          </span>
        ))}
      </div>
    </div>
  );
}

function FestivoDialog({
  festivo, defaultYear, onClose, onSave,
}: {
  festivo: Festivo | null;
  defaultYear: number;
  onClose: () => void;
  onSave: (data: { id?: string; fecha: string; nombre: string }) => void;
}) {
  const { t } = useTranslation();
  const [fecha, setFecha] = useState(
    festivo?.fecha ?? `${defaultYear}-01-01`,
  );
  const [nombre, setNombre] = useState(festivo?.nombre ?? "");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {festivo ? t("admin.calendario.editFestivo") : t("admin.calendario.addFestivo")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>{t("admin.calendario.colDate")}</Label>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div>
            <Label>{t("admin.common.title")}</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("admin.common.cancel")}</Button>
          <Button
            disabled={!fecha || !nombre.trim()}
            onClick={() => onSave({ id: festivo?.id, fecha, nombre: nombre.trim() })}
          >
            {t("admin.common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TimeEntryDialog({
  entry, onClose, onSave,
}: {
  entry: TimeEntry | null;
  onClose: () => void;
  onSave: (data: Partial<TimeEntry> & { id?: string }) => void;
}) {
  const { t } = useTranslation();
  const [workDate, setWorkDate] = useState(entry?.work_date ?? format(new Date(), "yyyy-MM-dd"));
  const [clockIn, setClockIn] = useState(
    entry?.clock_in ? format(parseISO(entry.clock_in), "yyyy-MM-dd'T'HH:mm") : "",
  );
  const [clockOut, setClockOut] = useState(
    entry?.clock_out ? format(parseISO(entry.clock_out), "yyyy-MM-dd'T'HH:mm") : "",
  );
  const [notes, setNotes] = useState(entry?.notes ?? "");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{entry ? t("admin.calendario.editEntry") : t("admin.calendario.newEntry")}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>{t("admin.common.date")}</Label><Input type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} /></div>
          <div><Label>{t("admin.calendario.colIn")}</Label><Input type="datetime-local" value={clockIn} onChange={(e) => setClockIn(e.target.value)} /></div>
          <div><Label>{t("admin.calendario.colOut")}</Label><Input type="datetime-local" value={clockOut} onChange={(e) => setClockOut(e.target.value)} /></div>
          <div><Label>{t("admin.common.notes")}</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("admin.common.cancel")}</Button>
          <Button onClick={() => onSave({
            id: entry?.id,
            work_date: workDate,
            clock_in: new Date(clockIn).toISOString(),
            clock_out: clockOut ? new Date(clockOut).toISOString() : null,
            notes,
          })}>{t("admin.common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AbsenceRequestDialog({
  onClose, onSubmit,
}: {
  onClose: () => void;
  onSubmit: (f: { start_date: string; end_date: string; notes: string }) => void;
}) {
  const { t } = useTranslation();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("admin.calendario.requestVacation")}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>{t("admin.common.start")}</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div><Label>{t("admin.common.end")}</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          <div><Label>{t("admin.common.notes")}</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("admin.common.cancel")}</Button>
          <Button onClick={() => onSubmit({ start_date: start, end_date: end, notes })}>{t("admin.common.submit")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdminAbsenceDialog({
  staff, onClose, onSubmit,
}: {
  staff: { user_id: string; full_name: string | null }[];
  onClose: () => void;
  onSubmit: (f: {
    user_id: string; start_date: string; end_date: string;
    absence_type: AbsenceType; notes: string;
  }) => void;
}) {
  const { t } = useTranslation();
  const [userId, setUserId] = useState(staff[0]?.user_id ?? "");
  const [type, setType] = useState<AbsenceType>("sick_leave");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("admin.calendario.adminEventTitle")}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>{t("admin.common.employee")}</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {staff.map((s) => (
                  <SelectItem key={s.user_id} value={s.user_id}>{s.full_name ?? s.user_id.slice(0, 8)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("admin.common.type")}</Label>
            <Select value={type} onValueChange={(v) => setType(v as AbsenceType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ADMIN_ABSENCE_TYPES.map((key) => (
                  <SelectItem key={key} value={key}>{t(`admin.absenceTypes.${key}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>{t("admin.common.start")}</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div><Label>{t("admin.common.end")}</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          <div><Label>{t("admin.common.notes")}</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("admin.common.cancel")}</Button>
          <Button onClick={() => onSubmit({ user_id: userId, start_date: start, end_date: end, absence_type: type, notes })}>
            {t("admin.common.register")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
