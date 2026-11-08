"use client";

import { useEffect, useState } from "react";
import { useT, useLocale } from "@/i18n/provider";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { countActiveBulletins } from "@/lib/bulletins-repository";
import { maxActiveBulletins, type PlanType } from "@/lib/rbac";
import { DEMO_PROFILES } from "@/lib/demo-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listBulletinDeliveries } from "@/lib/bulletin-deliveries-store";
import { upsertOrg, listOrgs } from "@/lib/orgs-store";
import { AiUsagePanel } from "@/components/ai-usage-panel";
import { countClientAiUsageThisMonth } from "@/lib/ai/usage-store";
import { demoApiHeaders } from "@/lib/api/demo-headers";
import {
  CATALOG_ADDONS,
  CATALOG_PLANS,
  formatEuros,
  type BillingCycle,
} from "@/lib/billing/catalog";
import {
  effectiveMaxAiGenerations,
  effectiveMaxUsers,
  getQuotaOverride,
  purchaseAddonDemo,
} from "@/lib/quota-overrides";

export default function BillingPage() {
  const t = useT();
  const { locale } = useLocale();
  const { user, demo, setDemoPlan } = useAuth();
  const [active, setActive] = useState(0);
  const [sends, setSends] = useState(0);
  const [aiUsed, setAiUsed] = useState(0);
  const [overrideTick, setOverrideTick] = useState(0);
  const [cycle, setCycle] = useState<BillingCycle>("month");

  useEffect(() => {
    let cancelled = false;
    if (user) {
      void countActiveBulletins(user.id).then((n) => {
        if (!cancelled) setActive(n);
      });
      if (demo) {
        setAiUsed(countClientAiUsageThisMonth(user.id));
      } else {
        void fetch("/api/usage", { headers: demoApiHeaders(user) })
          .then((r) => r.json())
          .then((data: { events?: Array<{ at?: string }> }) => {
            if (cancelled) return;
            const since = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
            const events = Array.isArray(data.events) ? data.events : [];
            setAiUsed(events.filter((e) => (e.at ?? "") >= since).length);
          })
          .catch(() => {
            if (!cancelled) setAiUsed(0);
          });
      }
    }
    setSends(listBulletinDeliveries().length);
    return () => {
      cancelled = true;
    };
  }, [user, demo]);

  const bulletinCap = maxActiveBulletins(user?.plan);
  const userCap = effectiveMaxUsers(user?.plan, user?.organizationId);
  const aiCap = effectiveMaxAiGenerations(user?.plan, user?.organizationId);
  const aiRemaining = aiCap === null ? null : Math.max(0, aiCap - aiUsed);
  const orgUsers = DEMO_PROFILES.filter((p) => p.organizationId === user?.organizationId).length;
  const override = user?.organizationId ? getQuotaOverride(user.organizationId) : null;
  void overrideTick;

  async function checkout(plan: PlanType) {
    if (demo) {
      toast.message(t("billing.demoStripe"));
      return;
    }
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan, cycle, locale, orgId: user?.organizationId ?? "" }),
    });
    const data = (await res.json()) as { url?: string; error?: string };
    if (data.url) window.location.href = data.url;
    else toast.error(data.error ?? t("billing.demoStripe"));
  }

  async function openPortal() {
    if (demo) {
      toast.message(t("billing.portalDemoOnly"));
      return;
    }
    const res = await fetch("/api/stripe/portal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locale }),
    });
    const data = (await res.json()) as { url?: string; error?: string };
    if (data.url) window.location.href = data.url;
    else toast.error(data.error ?? t("billing.portalError"));
  }

  function simulateUpgrade(plan: PlanType) {
    setDemoPlan(plan);
    if (user?.organizationId) {
      const org = listOrgs().find((o) => o.id === user.organizationId);
      if (org) upsertOrg({ ...org, plan });
    }
    toast.success(t("billing.simulatedUpgrade"));
  }

  async function checkoutAddon(kind: "seats" | "sends") {
    const { track } = await import("@/lib/analytics");
    void track("checkout_click", { addon: kind, organizationId: user?.organizationId ?? null, demo });
    const priceEnv = kind === "seats" ? "STRIPE_PRICE_ADDON_SEATS" : "STRIPE_PRICE_ADDON_SENDS";
    const res = await fetch("/api/stripe/checkout-addon", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, locale, orgId: user?.organizationId ?? "" }),
    });
    if (res.status === 404 || res.status === 501) {
      if (user?.organizationId && (demo || res.status === 501)) {
        purchaseAddonDemo(user.organizationId, kind);
        setOverrideTick((n) => n + 1);
        toast.success(t("billing.addonDemoPurchased"));
        return;
      }
      toast.message(`${t("billing.addonMissingPrice")} (${priceEnv})`);
      return;
    }
    const data = (await res.json()) as { url?: string; error?: string; demo?: boolean };
    if (data.url) window.location.href = data.url;
    else if (user?.organizationId) {
      purchaseAddonDemo(user.organizationId, kind);
      setOverrideTick((n) => n + 1);
      toast.success(t("billing.addonDemoPurchased"));
    } else toast.message(data.error ?? t("billing.addonDemo"));
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-display text-3xl font-bold tracking-tight">{t("dashboard.billing")}</h1>
      <p className="text-sm text-muted-foreground">
        {t("billing.current")} <strong className="uppercase">{user?.plan}</strong>
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("billing.bulletinsUsed")}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {active} / {bulletinCap ?? "∞"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("billing.usersUsed")}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {orgUsers} / {userCap ?? "∞"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("billing.sends")}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{sends}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("billing.aiQuota")}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {aiRemaining === null ? "∞" : aiRemaining}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {aiCap === null ? t("billing.aiUnlimited") : `${aiUsed} / ${aiCap}`}
            </span>
          </CardContent>
        </Card>
      </div>
      <p className="text-sm text-muted-foreground">{t("billing.portalNote")}</p>
      <p className="text-sm text-muted-foreground">{t("pricing.vat")}</p>
      <div className="inline-flex rounded-full border bg-card p-1">
        {(["month", "year"] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${cycle === value ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            onClick={() => setCycle(value)}
          >
            {value === "month" ? t("billing.cycleMonth") : t("billing.cycleYear")}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => void openPortal()}>
          {t("billing.manage")}
        </Button>
        {CATALOG_PLANS.map((offer) => {
          const cents = cycle === "year" ? offer.yearlyCents : offer.monthlyCents;
          const suffix = cycle === "year" ? t("pricing.year") : t("pricing.month");
          return (
            <Button
              key={offer.plan}
              variant={user?.plan === offer.plan ? "default" : "outline"}
              onClick={() => void checkout(offer.plan)}
            >
              {offer.plan} · {formatEuros(cents, locale)}€{suffix}
            </Button>
          );
        })}
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-lg font-semibold">{t("billing.addonsTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("billing.addonsLead")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void checkoutAddon("seats")}>
            {t("billing.addonSeats")} · {formatEuros(CATALOG_ADDONS.seats.cents, locale)}€{t("pricing.month")}
          </Button>
          <Button type="button" variant="outline" onClick={() => void checkoutAddon("sends")}>
            {t("billing.addonSends")} · {formatEuros(CATALOG_ADDONS.sends.cents, locale)}€{t("pricing.month")}
          </Button>
        </div>
        {override ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {t("billing.quotaOverride")}: +{override.extraSeats ?? 0} seats · +{override.extraSends ?? 0}{" "}
            sends · +{override.extraAi ?? 0} AI
          </p>
        ) : null}
      </div>
      {demo ? (
        <div className="rounded-xl border border-dashed p-4">
          <p className="text-sm text-muted-foreground">{t("billing.simulateHint")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["starter", "business", "enterprise"] as PlanType[]).map((plan) => (
              <Button key={plan} type="button" size="sm" variant="secondary" onClick={() => simulateUpgrade(plan)}>
                {t("billing.simulateUpgrade")} · {plan}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
      <AiUsagePanel />
    </div>
  );
}
