import Link from "next/link";
import { ArrowRight, BellOff, Clock, Copy, Filter, Languages, Newspaper } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/locales";
import { createTranslator } from "@/i18n/server";
import { withLocale } from "@/lib/paths";
import { Button } from "@/components/ui/button";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "es") as Locale;
  const t = createTranslator(locale);
  const href = (path: string) => withLocale(locale, path);

  const stats = [
    { value: t("home.stat1Value"), label: t("home.stat1Label") },
    { value: t("home.stat2Value"), label: t("home.stat2Label") },
    { value: t("home.stat3Value"), label: t("home.stat3Label") },
    { value: t("home.stat4Value"), label: t("home.stat4Label") },
  ];

  const steps = [
    { icon: Filter, title: t("home.step1Title"), body: t("home.step1Body") },
    { icon: Newspaper, title: t("home.step2Title"), body: t("home.step2Body") },
    { icon: Languages, title: t("home.step3Title"), body: t("home.step3Body") },
  ];

  const pains = [
    { icon: BellOff, title: t("home.pain1Title"), body: t("home.pain1Body") },
    { icon: Clock, title: t("home.pain2Title"), body: t("home.pain2Body") },
    { icon: Copy, title: t("home.pain3Title"), body: t("home.pain3Body") },
  ];

  return (
    <div>
      <section className="mesh-hero relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 pb-20 pt-16 sm:pb-28 sm:pt-24">
          <p className="mb-5 inline-flex rounded-full border border-signal/40 bg-signal/15 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-signal">
            {t("home.badge")}
          </p>
          <h1 className="max-w-3xl font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl">
            {t("home.title")}{" "}
            <span className="text-gradient-signal">{t("home.titleHighlight")}</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">{t("home.subtitle")}</p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href={href("/registro")}>
                {t("home.cta")} <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href={href("/servicios")}>{t("home.ctaSecondary")}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-y border-primary/10 bg-gradient-to-r from-primary/5 via-accent/50 to-signal/10">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="font-display text-4xl font-bold tracking-tight text-primary">{s.value}</p>
              <p className="mt-1 text-sm font-medium text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-signal">{t("home.improveTitle")}</p>
        <h2 className="mt-2 max-w-3xl font-display text-4xl font-bold tracking-tight">{t("home.improveLead")}</h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {pains.map((pain) => (
            <article key={pain.title} className="glass-card p-7">
              <span className="mb-4 inline-flex size-10 items-center justify-center rounded-xl bg-accent text-signal">
                <pain.icon className="size-4" aria-hidden />
              </span>
              <h3 className="font-display text-xl font-semibold tracking-tight">{pain.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{pain.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <h2 className="font-display text-4xl font-bold tracking-tight">{t("home.howTitle")}</h2>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">{t("home.howLead")}</p>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((step) => (
            <article key={step.title} className="glass-card p-7">
              <span className="mb-5 inline-flex size-11 items-center justify-center rounded-xl bg-accent text-signal">
                <step.icon className="size-5" aria-hidden />
              </span>
              <h3 className="font-display text-xl font-semibold tracking-tight">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
