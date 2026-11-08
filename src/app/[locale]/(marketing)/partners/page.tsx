import Link from "next/link";
import { isLocale, type Locale } from "@/i18n/locales";
import { createTranslator } from "@/i18n/server";
import { withLocale } from "@/lib/paths";
import { Button } from "@/components/ui/button";

export default async function PartnersMarketingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "es") as Locale;
  const t = createTranslator(locale);

  return (
    <div>
      <section className="mesh-hero border-b border-border">
        <div className="mx-auto max-w-4xl px-4 py-20 sm:py-28">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{t("partners.eyebrow")}</p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">{t("partners.title")}</h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">{t("partners.lead")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href={withLocale(locale, "/contacto")}>{t("partners.cta")}</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href={withLocale(locale, "/registro")}>{t("nav.register")}</Link>
            </Button>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-4xl px-4 py-16">
        <h2 className="font-display text-2xl font-semibold text-ink">{t("partners.whoTitle")}</h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">{t("partners.whoBody")}</p>
        <h2 className="mt-10 font-display text-2xl font-semibold text-ink">{t("partners.benefitTitle")}</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>{t("partners.benefit1")}</li>
          <li>{t("partners.benefit2")}</li>
          <li>{t("partners.benefit3")}</li>
        </ul>
      </section>
    </div>
  );
}
