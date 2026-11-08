import Link from "next/link";
import { isLocale, type Locale } from "@/i18n/locales";
import { createTranslator } from "@/i18n/server";
import { withLocale } from "@/lib/paths";
import { Button } from "@/components/ui/button";

export default async function InnovationCapitalOsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "es") as Locale;
  const t = createTranslator(locale);

  return (
    <div>
      <section className="relative overflow-hidden mesh-hero border-b border-border">
        <div className="pointer-events-none absolute inset-0 landing-grid" aria-hidden />
        <div className="relative mx-auto max-w-4xl px-4 py-24 sm:py-32">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{t("category.eyebrow")}</p>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl lg:text-6xl">
            {t("category.title")}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">{t("category.lead")}</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href={withLocale(locale, "/servicios")}>{t("home.ctaSecondary")}</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href={withLocale(locale, "/registro")}>{t("home.cta")}</Link>
            </Button>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-4xl space-y-10 px-4 py-16">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">{t("category.problemTitle")}</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">{t("category.problemBody")}</p>
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">{t("category.osTitle")}</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">{t("category.osBody")}</p>
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">{t("category.whoTitle")}</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">{t("category.whoBody")}</p>
        </div>
      </section>
    </div>
  );
}
