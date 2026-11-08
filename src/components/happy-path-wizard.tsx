"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, FileText, FolderKanban, Newspaper, Search } from "lucide-react";
import { SHOWCASE_BULLETIN_ID, SHOWCASE_MARKET_ID, SHOWCASE_PROJECT_ID } from "@/lib/showcase-case";
import { useLocale, useT } from "@/i18n/provider";
import { withLocale } from "@/lib/paths";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "menoska_happy_path_done";

const STEPS = [
  {
    key: "case",
    icon: FolderKanban,
    href: `/dashboard/proyectos/${SHOWCASE_PROJECT_ID}`,
    titleKey: "happyPath.step1Title" as const,
    bodyKey: "happyPath.step1Body" as const,
  },
  {
    key: "watch",
    icon: Newspaper,
    href: `/dashboard/boletines/${SHOWCASE_BULLETIN_ID}`,
    titleKey: "happyPath.step2Title" as const,
    bodyKey: "happyPath.step2Body" as const,
  },
  {
    key: "patents",
    icon: Search,
    href: "/dashboard/modulos/scouting/patentes-fto",
    titleKey: "happyPath.step3Title" as const,
    bodyKey: "happyPath.step3Body" as const,
  },
  {
    key: "report",
    icon: FileText,
    href: `/dashboard/informe-mercado/${SHOWCASE_MARKET_ID}`,
    titleKey: "happyPath.step4Title" as const,
    bodyKey: "happyPath.step4Body" as const,
  },
];

/** First-time happy path: Crear boletín → Enviar → Generar informe */
export function HappyPathWizard() {
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

  return (
    <div className="rounded-xl border border-primary/25 bg-gradient-to-br from-primary/[0.06] to-transparent px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-primary">
            {t("happyPath.badge")}
          </p>
          <h2 className="mt-1 font-display text-base font-semibold text-ink">{t("happyPath.title")}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("happyPath.lead")}</p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={dismiss}>
          {t("happyPath.dismiss")}
        </Button>
      </div>
      <ol className="mt-4 grid gap-2 md:grid-cols-4">
        {STEPS.map((step, i) => (
          <li key={step.key}>
            <Link
              href={withLocale(locale, step.href)}
              className="group flex h-full flex-col rounded-lg border border-border/80 bg-card px-3 py-3 transition-colors hover:border-primary/40 hover:bg-accent/40"
            >
              <span className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 font-mono text-[10px] font-semibold text-primary">
                  {i + 1}
                </span>
                <step.icon className="size-3.5 text-muted-foreground" />
              </span>
              <span className="mt-2 text-sm font-medium text-foreground">{t(step.titleKey)}</span>
              <span className="mt-1 flex-1 text-xs text-muted-foreground">{t(step.bodyKey)}</span>
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-80 group-hover:opacity-100">
                {t("happyPath.go")}
                <ArrowRight className="size-3" />
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
