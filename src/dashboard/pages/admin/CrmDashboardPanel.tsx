import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import {
  Loader2, LayoutDashboard, Users, FileText, FileCheck2, BarChart3,
  Mail, Reply, AlertTriangle, Eye, Send,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/dashboard/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/dashboard/components/ui/card";
import { Badge } from "@/dashboard/components/ui/badge";
import type { CrmDashboardMetrics, CrmMemoriaMonthlySnapshot, CrmPlanMonthlySnapshot } from "@/dashboard/types/admin";
import { cn } from "@/dashboard/lib/utils";
import { salesFrom } from "@/dashboard/pages/admin/agente-comercial/salesDb";

type DeliverabilityStats = {
  sent: number;
  sent7d: number;
  sent30d: number;
  opened: number;
  replied: number;
  bounced: number;
  failed: number;
};

function emptyDeliverability(): DeliverabilityStats {
  return { sent: 0, sent7d: 0, sent30d: 0, opened: 0, replied: 0, bounced: 0, failed: 0 };
}

function pct(part: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((part / total) * 1000) / 10;
}

function deliverabilityHealth(stats: DeliverabilityStats): "ok" | "warn" | "danger" | "idle" {
  if (stats.sent < 5) return "idle";
  const bounceRate = (stats.bounced / stats.sent) * 100;
  const replyRate = (stats.replied / stats.sent) * 100;
  if (bounceRate >= 5 || (stats.sent >= 20 && replyRate < 0.5)) return "danger";
  if (bounceRate >= 2 || (stats.sent >= 20 && replyRate < 1.5)) return "warn";
  return "ok";
}

function monthLabel(monthDate: string): string {
  // month_date comes as YYYY-MM-DD (first day of month)
  return monthDate.slice(0, 7).slice(5);
}

function MetricKpi({
  icon: Icon,
  label,
  value,
  color,
  suffix,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  color: string;
  suffix?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className={cn("text-2xl font-bold mt-1 tabular-nums", color)}>
              {value}{suffix}
            </p>
          </div>
          <div className={cn("rounded-md p-2 bg-muted/60", color)}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StackedPlanChart({
  history,
  live,
}: {
  history: CrmPlanMonthlySnapshot[];
  live: CrmDashboardMetrics["live"] | null;
}) {
  const { t } = useTranslation();

  const points = useMemo(() => {
    const byMonth = new Map<string, CrmPlanMonthlySnapshot>();
    for (const row of history) byMonth.set(row.month_date.slice(0, 7), row);

    if (live) {
      const now = new Date();
      const key = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
      byMonth.set(key, {
        month_date: `${key}-01`,
        users_total: live.users_total,
        users_free: live.users_free,
        users_pro: live.users_pro,
        users_business: live.users_business,
        captured_at: new Date().toISOString(),
      });
    }

    return [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([, row]) => row);
  }, [history, live]);

  const max = Math.max(...points.map((p) => p.users_total), 1);

  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground py-10 text-center">{t("admin.crm.dashboardNoHistory")}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3 h-44">
        {points.map((m) => {
          const h = (m.users_total / max) * 100;
          const freePct = m.users_total > 0 ? (m.users_free / m.users_total) * 100 : 0;
          const proPct = m.users_total > 0 ? (m.users_pro / m.users_total) * 100 : 0;
          const bizPct = m.users_total > 0 ? (m.users_business / m.users_total) * 100 : 0;
          return (
            <div key={m.month_date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <span className="text-[10px] text-muted-foreground tabular-nums">{m.users_total}</span>
              <div
                className="w-full flex flex-col-reverse rounded-t-md overflow-hidden min-h-[4px]"
                style={{ height: `${Math.max(h, 4)}%` }}
                title={`${m.month_date.slice(0, 7)}: free ${m.users_free} · pro ${m.users_pro} · business ${m.users_business}`}
              >
                <div className="w-full bg-slate-400/80" style={{ height: `${freePct}%` }} />
                <div className="w-full bg-sky-500/90" style={{ height: `${proPct}%` }} />
                <div className="w-full bg-emerald-500/90" style={{ height: `${bizPct}%` }} />
              </div>
              <span className="text-[10px] font-medium">{monthLabel(m.month_date)}</span>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-slate-400/80" /> {t("admin.crm.dashboardPlanFree")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-sky-500/90" /> {t("admin.crm.dashboardPlanPro")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/90" /> {t("admin.crm.dashboardPlanBusiness")}
        </span>
      </div>
    </div>
  );
}

function DualMemoriaChart({
  history,
  live,
}: {
  history: CrmMemoriaMonthlySnapshot[];
  live: CrmDashboardMetrics["live"] | null;
}) {
  const { t } = useTranslation();

  const points = useMemo(() => {
    const byMonth = new Map<string, CrmMemoriaMonthlySnapshot>();
    for (const row of history) byMonth.set(row.month_date.slice(0, 7), row);

    if (live) {
      const now = new Date();
      const key = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
      byMonth.set(key, {
        month_date: `${key}-01`,
        memorias_redactadas: live.memorias_redactadas,
        memorias_revisadas: live.memorias_revisadas,
        captured_at: new Date().toISOString(),
      });
    }

    return [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([, row]) => row);
  }, [history, live]);

  const max = Math.max(
    ...points.flatMap((p) => [p.memorias_redactadas, p.memorias_revisadas]),
    1,
  );

  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground py-10 text-center">{t("admin.crm.dashboardNoHistory")}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3 h-44">
        {points.map((m) => (
          <div key={m.month_date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <span className="text-[10px] text-muted-foreground tabular-nums leading-tight text-center">
              {m.memorias_redactadas}/{m.memorias_revisadas}
            </span>
            <div className="flex-1 w-full flex items-end justify-center gap-0.5 min-h-0 self-stretch">
              <div
                className="flex-1 bg-violet-500/85 rounded-t-md min-h-[4px] transition-all"
                style={{ height: `${Math.max((m.memorias_redactadas / max) * 100, 4)}%` }}
                title={`${t("admin.crm.dashboardMemoriasRedactadas")}: ${m.memorias_redactadas}`}
              />
              <div
                className="flex-1 bg-amber-500/85 rounded-t-md min-h-[4px] transition-all"
                style={{ height: `${Math.max((m.memorias_revisadas / max) * 100, 4)}%` }}
                title={`${t("admin.crm.dashboardMemoriasRevisadas")}: ${m.memorias_revisadas}`}
              />
            </div>
            <span className="text-[10px] font-medium">{monthLabel(m.month_date)}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-violet-500/85" /> {t("admin.crm.dashboardMemoriasRedactadas")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/85" /> {t("admin.crm.dashboardMemoriasRevisadas")}
        </span>
      </div>
    </div>
  );
}

export function CrmDashboardPanel() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<CrmDashboardMetrics | null>(null);
  const [deliverability, setDeliverability] = useState<DeliverabilityStats>(emptyDeliverability);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const [metricsRes, logsRes] = await Promise.all([
        supabase.rpc("get_crm_dashboard_metrics"),
        salesFrom("sales_email_logs")
          .select("status, opened_at, replied_at, sent_at")
          .order("sent_at", { ascending: false })
          .limit(5000),
      ]);
      if (metricsRes.error) throw metricsRes.error;
      setMetrics(metricsRes.data as unknown as CrmDashboardMetrics);

      if (!logsRes.error && Array.isArray(logsRes.data)) {
        const now = Date.now();
        const d7 = now - 7 * 86_400_000;
        const d30 = now - 30 * 86_400_000;
        const next = emptyDeliverability();
        for (const row of logsRes.data as Array<{
          status: string;
          opened_at: string | null;
          replied_at: string | null;
          sent_at: string | null;
        }>) {
          if (row.status === "sent") next.sent += 1;
          else if (row.status === "bounced") next.bounced += 1;
          else if (row.status === "failed") next.failed += 1;
          if (row.opened_at) next.opened += 1;
          if (row.replied_at) next.replied += 1;
          const sentMs = row.sent_at ? new Date(row.sent_at).getTime() : NaN;
          if (Number.isFinite(sentMs) && row.status === "sent") {
            if (sentMs >= d7) next.sent7d += 1;
            if (sentMs >= d30) next.sent30d += 1;
          }
        }
        setDeliverability(next);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.crm.dashboardLoadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchMetrics();
  }, [fetchMetrics]);

  if (loading && !metrics) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
      </div>
    );
  }

  const live = metrics?.live ?? null;
  const openRate = pct(deliverability.opened, deliverability.sent);
  const replyRate = pct(deliverability.replied, deliverability.sent);
  const bounceRate = pct(deliverability.bounced, Math.max(deliverability.sent + deliverability.bounced, 1));
  const health = deliverabilityHealth(deliverability);
  const healthLabel =
    health === "ok" ? t("admin.crm.deliverabilityHealthOk")
      : health === "warn" ? t("admin.crm.deliverabilityHealthWarn")
        : health === "danger" ? t("admin.crm.deliverabilityHealthDanger")
          : t("admin.crm.deliverabilityHealthIdle");
  const healthClass =
    health === "ok" ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10"
      : health === "warn" ? "border-amber-500/40 text-amber-800 dark:text-amber-300 bg-amber-500/10"
        : health === "danger" ? "border-red-500/40 text-red-700 dark:text-red-400 bg-red-500/10"
          : "border-slate-500/30 text-muted-foreground bg-muted/40";

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricKpi
          icon={Users}
          label={t("admin.crm.dashboardUsersTotal")}
          value={live?.users_total ?? 0}
          color="text-foreground"
        />
        <MetricKpi
          icon={Users}
          label={t("admin.crm.dashboardPlanFree")}
          value={live?.users_free ?? 0}
          color="text-slate-400"
        />
        <MetricKpi
          icon={Users}
          label={t("admin.crm.dashboardPlanPro")}
          value={live?.users_pro ?? 0}
          color="text-sky-500"
        />
        <MetricKpi
          icon={Users}
          label={t("admin.crm.dashboardPlanBusiness")}
          value={live?.users_business ?? 0}
          color="text-emerald-500"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <MetricKpi
          icon={FileText}
          label={t("admin.crm.dashboardMemoriasRedactadas")}
          value={live?.memorias_redactadas ?? 0}
          color="text-violet-500"
        />
        <MetricKpi
          icon={FileCheck2}
          label={t("admin.crm.dashboardMemoriasRevisadas")}
          value={live?.memorias_revisadas ?? 0}
          color="text-amber-500"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="w-4 h-4" /> {t("admin.crm.deliverabilityTitle")}
            </CardTitle>
            <CardDescription className="mt-1">{t("admin.crm.deliverabilityDesc")}</CardDescription>
          </div>
          <Badge variant="outline" className={cn("shrink-0", healthClass)}>
            {healthLabel}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <MetricKpi
              icon={Send}
              label={t("admin.crm.deliverabilitySent")}
              value={deliverability.sent}
              color="text-foreground"
            />
            <MetricKpi
              icon={Send}
              label={t("admin.crm.deliverabilitySent7d")}
              value={deliverability.sent7d}
              color="text-sky-500"
            />
            <MetricKpi
              icon={Eye}
              label={t("admin.crm.deliverabilityOpenRate")}
              value={openRate == null ? "—" : openRate}
              suffix={openRate == null ? undefined : "%"}
              color="text-violet-500"
            />
            <MetricKpi
              icon={Reply}
              label={t("admin.crm.deliverabilityReplyRate")}
              value={replyRate == null ? "—" : replyRate}
              suffix={replyRate == null ? undefined : "%"}
              color="text-emerald-500"
            />
            <MetricKpi
              icon={AlertTriangle}
              label={t("admin.crm.deliverabilityBounceRate")}
              value={deliverability.sent + deliverability.bounced === 0 ? "—" : (bounceRate ?? 0)}
              suffix={deliverability.sent + deliverability.bounced === 0 ? undefined : "%"}
              color="text-red-500"
            />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("admin.crm.deliverabilityHint")}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="w-4 h-4" /> {t("admin.crm.dashboardPlansChart")}
            </CardTitle>
            <CardDescription>{t("admin.crm.dashboardPlansChartDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <StackedPlanChart history={metrics?.plan_history ?? []} live={live} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LayoutDashboard className="w-4 h-4" /> {t("admin.crm.dashboardMemoriasChart")}
            </CardTitle>
            <CardDescription>{t("admin.crm.dashboardMemoriasChartDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <DualMemoriaChart history={metrics?.memoria_history ?? []} live={live} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
