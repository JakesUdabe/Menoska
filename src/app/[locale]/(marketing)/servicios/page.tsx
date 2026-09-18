import { Building2, Radar, TrendingUp } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/locales";
import { createTranslator } from "@/i18n/server";

export default async function ServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "es") as Locale;
  const t = createTranslator(locale);

  const items = [
    { icon: Radar, title: t("services.patentsTitle"), body: t("services.patentsBody") },
    { icon: Building2, title: t("services.competitorsTitle"), body: t("services.competitorsBody") },
    { icon: TrendingUp, title: t("services.trendsTitle"), body: t("services.trendsBody") },
  ];

  return (
    <div className="mesh-hero">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-signal">{t("services.eyebrow")}</p>
        <h1 className="mt-2 max-w-3xl font-display text-4xl font-bold tracking-tight sm:text-5xl">{t("services.title")}</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{t("services.lead")}</p>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {items.map((item) => (
            <article key={item.title} className="glass-card p-7">
              <span className="mb-5 inline-flex size-11 items-center justify-center rounded-xl bg-accent text-signal">
                <item.icon className="size-5" />
              </span>
              <h2 className="font-display text-xl font-semibold tracking-tight">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </article>
          ))}
        </div>
        <aside className="mt-12 rounded-2xl bg-gradient-to-br from-primary via-primary to-signal px-7 py-9 text-primary-foreground shadow-[0_24px_50px_-24px_color-mix(in_oklab,var(--primary)_80%,transparent)]">
          <h2 className="font-display text-2xl font-bold tracking-tight">{t("services.andTitle")}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed opacity-90">{t("services.andBody")}</p>
        </aside>
      </div>
    </div>
  );
}
