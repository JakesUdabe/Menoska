"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, CreditCard, FileText, FolderKanban, Newspaper } from "lucide-react";
import { SHOWCASE_BULLETIN_ID, SHOWCASE_MARKET_ID, SHOWCASE_PROJECT_ID } from "@/lib/showcase-case";
import { useLocale, useT } from "@/i18n/provider";
import { withLocale } from "@/lib/paths";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "menoska_onboarding_done";

export function OnboardingChecklist() {
  const t = useT();
  const { locale } = useLocale();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(localStorage.getItem(STORAGE_KEY) !== "1");
    } catch {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible) return null;

  const steps = [
    {
      icon: FolderKanban,
      label: t("onboarding.step1"),
      href: withLocale(locale, `/dashboard/proyectos/${SHOWCASE_PROJECT_ID}`),
    },
    {
      icon: Newspaper,
      label: t("onboarding.step2"),
      href: withLocale(locale, `/dashboard/boletines/${SHOWCASE_BULLETIN_ID}`),
    },
    {
      icon: FileText,
      label: t("onboarding.step3"),
      href: withLocale(locale, `/dashboard/informe-mercado/${SHOWCASE_MARKET_ID}`),
    },
    {
      icon: CreditCard,
      label: t("onboarding.step4"),
      href: withLocale(locale, "/dashboard/facturacion"),
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 sm:px-5 sm:py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-primary">
            {t("onboarding.badge")}
          </p>
          <h2 className="mt-1 font-display text-base font-semibold text-ink">{t("onboarding.title")}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("onboarding.lead")}</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={dismiss}>
          <Check className="size-3.5" />
          {t("onboarding.done")}
        </Button>
      </div>
      <ol className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {steps.map((step, i) => (
          <li key={step.href}>
            <Link
              href={step.href}
              className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-accent/60"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 font-mono text-[10px] font-semibold text-primary">
                {i + 1}
              </span>
              <step.icon className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="text-foreground">{step.label}</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
