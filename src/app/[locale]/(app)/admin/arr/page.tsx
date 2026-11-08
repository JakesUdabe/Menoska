"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/components/auth-provider";
import { useLocale, useT } from "@/i18n/provider";
import { withLocale } from "@/lib/paths";
import { isSuperAdmin, type PlanType } from "@/lib/rbac";
import { listOrgs, type OrgRecord } from "@/lib/orgs-repository";

const PLAN_MRR: Record<string, number> = {
  starter: 149,
  business: 349,
  enterprise: 890,
};

export default function AdminArrPage() {
  const t = useT();
  const { locale } = useLocale();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [orgs, setOrgs] = useState<OrgRecord[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!loading && (!user || !isSuperAdmin(user.role))) {
      router.replace(withLocale(locale, "/admin"));
    }
  }, [loading, user, locale, router]);

  useEffect(() => {
    let cancelled = false;
    void listOrgs()
      .then((rows) => {
        if (!cancelled) setOrgs(rows);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !user || !isSuperAdmin(user.role) || !ready) {
    return <div className="p-4 text-sm text-muted-foreground">{t("common.loading")}</div>;
  }

  const demoOrgs: Array<{ id: string; plan: PlanType; mrr?: number }> =
    orgs.length > 0
      ? orgs.map((o) => ({ id: o.id, plan: o.plan, mrr: o.mrr }))
      : [
          { id: "1", plan: "starter", mrr: PLAN_MRR.starter },
          { id: "2", plan: "business", mrr: PLAN_MRR.business },
          { id: "3", plan: "enterprise", mrr: PLAN_MRR.enterprise },
        ];

  const byPlan: Record<string, number> = { starter: 0, business: 0, enterprise: 0 };
  let mrrSum = 0;
  for (const o of demoOrgs) {
    const plan = o.plan ?? "starter";
    byPlan[plan] = (byPlan[plan] ?? 0) + 1;
    mrrSum += typeof o.mrr === "number" && o.mrr > 0 ? o.mrr : PLAN_MRR[plan] ?? 199;
  }

  const months = ["May", "Jun", "Jul", "Aug", "Sep", "Oct"];
  const series = months.map((m, i) => ({
    month: m,
    mrr: Math.round(mrrSum * (0.55 + i * 0.09)),
  }));
  const arr = mrrSum * 12;

  const fmt = (n: number) =>
    new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-700">{t("arr.badge")}</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">{t("arr.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("arr.lead")}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {orgs.length > 0 ? t("arr.fromOrgs") : t("arr.fallbackHardcoded")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">MRR ({t("arr.mock")})</p>
          <p className="mt-1 font-display text-2xl font-semibold">{fmt(mrrSum)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">ARR ({t("arr.mock")})</p>
          <p className="mt-1 font-display text-2xl font-semibold text-primary">{fmt(arr)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("arr.byPlan")}</p>
          <p className="mt-1 font-mono text-sm">
            S {byPlan.starter} · B {byPlan.business} · E {byPlan.enterprise}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-amber-600/40 bg-amber-50/50 p-4 dark:bg-amber-950/20">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">{t("arr.disclaimer")}</p>
      </div>

      <div className="h-72 rounded-xl border border-border bg-card p-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Area type="monotone" dataKey="mrr" stroke="#00895B" fill="#00895B33" name="MRR proyección" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
