import { isLocale, type Locale } from "@/i18n/locales";
import { createTranslator } from "@/i18n/server";

export default async function DpaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "es") as Locale;
  const t = createTranslator(locale);

  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{t("dpa.eyebrow")}</p>
      <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-ink">{t("dpa.title")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("legal.lastUpdated")}</p>
      <div className="mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>{t("dpa.lead")}</p>
        <h2 className="font-display text-lg font-semibold text-ink">{t("dpa.rolesTitle")}</h2>
        <p>{t("dpa.rolesBody")}</p>
        <h2 className="font-display text-lg font-semibold text-ink">{t("dpa.scopeTitle")}</h2>
        <p>{t("dpa.scopeBody")}</p>
        <h2 className="font-display text-lg font-semibold text-ink">{t("dpa.securityTitle")}</h2>
        <p>{t("dpa.securityBody")}</p>
        <h2 className="font-display text-lg font-semibold text-ink">{t("dpa.contactTitle")}</h2>
        <p>{t("dpa.contactBody")}</p>
      </div>
    </article>
  );
}
