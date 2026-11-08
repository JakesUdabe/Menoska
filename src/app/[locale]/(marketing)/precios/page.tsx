"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { useLocale, useT } from "@/i18n/provider";
import { withLocale } from "@/lib/paths";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATALOG_PLANS, formatEuros, type BillingCycle } from "@/lib/billing/catalog";

const plans = [
  {
    key: "starter" as const,
    features: ["pricing.starterF1", "pricing.starterF2", "pricing.starterF3", "pricing.starterF4", "pricing.starterF5"],
  },
  {
    key: "business" as const,
    popular: true,
    features: [
      "pricing.businessF1",
      "pricing.businessF2",
      "pricing.businessF3",
      "pricing.businessF4",
      "pricing.businessF5",
      "pricing.businessF6",
    ],
  },
  {
    key: "enterprise" as const,
    features: [
      "pricing.enterpriseF1",
      "pricing.enterpriseF2",
      "pricing.enterpriseF3",
      "pricing.enterpriseF4",
      "pricing.enterpriseF5",
      "pricing.enterpriseF6",
    ],
  },
];

export default function PricingPage() {
  const t = useT();
  const { locale } = useLocale();
  const [hours, setHours] = useState(40);
  const [rate, setRate] = useState(85);
  const [cycle, setCycle] = useState<BillingCycle>("month");
  const savings = useMemo(() => Math.round(hours * 0.7 * rate), [hours, rate]);

  return (
    <div className="mesh-hero">
    <div className="mx-auto max-w-6xl px-4 py-16">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-signal">{t("pricing.eyebrow")}</p>
      <h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">{t("pricing.title")}</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{t("pricing.lead")}</p>
      <p className="mt-3 max-w-2xl text-sm font-medium text-foreground/80">{t("pricing.businessUnlock")}</p>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t("pricing.vat")}</p>

      <div className="mt-8 inline-flex rounded-full border bg-card p-1">
        {(["month", "year"] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${cycle === value ? "bg-signal text-signal-foreground" : "text-muted-foreground"}`}
            onClick={() => setCycle(value)}
          >
            {value === "month" ? t("billing.cycleMonth") : t("billing.cycleYear")}
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {plans.map((plan) => {
          const offer = CATALOG_PLANS.find((row) => row.plan === plan.key);
          const cents = cycle === "year" ? offer?.yearlyCents : offer?.monthlyCents;
          return (
          <article
            key={plan.key}
            className={`flex flex-col rounded-2xl border p-7 ${plan.popular ? "border-signal bg-accent/50 shadow-[0_24px_50px_-24px_color-mix(in_oklab,var(--signal)_70%,transparent)] ring-1 ring-signal/30" : "bg-card"}`}
          >
            {plan.popular ? (
              <span className="mb-3 w-fit rounded-full bg-signal px-3 py-1 text-xs font-semibold uppercase tracking-wide text-signal-foreground">
                {t("pricing.popular")}
              </span>
            ) : null}
            <h2 className="font-display text-xl font-semibold tracking-tight">{t(`pricing.${plan.key}Name`)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t(`pricing.${plan.key}Desc`)}</p>
            <p className="mt-6 font-display text-4xl font-bold tracking-tight">
              {formatEuros(cents ?? 0, locale)}€
              <span className="text-base font-normal text-muted-foreground">
                {cycle === "year" ? t("pricing.year") : t("pricing.month")}
              </span>
            </p>
            <ul className="mt-6 flex-1 space-y-2 text-sm">
              {plan.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-signal" />
                  {t(f)}
                </li>
              ))}
            </ul>
            <Button className="mt-8" variant={plan.popular ? "default" : "outline"} asChild>
              <Link href={withLocale(locale, "/registro")}>{t("pricing.cta")}</Link>
            </Button>
          </article>
          );
        })}
      </div>

      <section className="mt-12 rounded-2xl border border-dashed bg-card/60 p-6">
        <h2 className="font-display text-lg font-semibold tracking-tight">{t("pricing.trustTitle")}</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>{t("pricing.trustSla")}</li>
          <li>{t("pricing.trustSso")}</li>
          <li>{t("pricing.trustDpa")}</li>
          <li>{t("pricing.trustEu")}</li>
        </ul>
      </section>

      <section className="mt-16 rounded-2xl border bg-card p-7">
        <h2 className="font-display text-2xl font-bold tracking-tight">{t("pricing.roiTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("pricing.roiNote")}</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="hours">{t("pricing.roiHours")}</Label>
            <Input id="hours" type="number" min={1} value={hours} onChange={(e) => setHours(Number(e.target.value) || 0)} />
          </div>
          <div>
            <Label htmlFor="rate">{t("pricing.roiRate")}</Label>
            <Input id="rate" type="number" min={1} value={rate} onChange={(e) => setRate(Number(e.target.value) || 0)} />
          </div>
          <div className="rounded-xl bg-gradient-to-br from-accent to-primary/10 p-4">
            <p className="text-sm font-medium text-muted-foreground">{t("pricing.roiSaved")}</p>
            <p className="mt-1 font-display text-3xl font-bold tracking-tight text-primary">{savings.toLocaleString(locale)} €</p>
          </div>
        </div>
      </section>
    </div>
    </div>
  );
}
