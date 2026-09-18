import { isLocale, type Locale } from "@/i18n/locales";
import { createTranslator } from "@/i18n/server";

export default async function LegalNoticePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "es") as Locale;
  const t = createTranslator(locale);
  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-4xl font-bold tracking-tight">{t("legal.noticeTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("legal.lastUpdated")}</p>
      <div className="mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>{t("legal.noticeBody1")}</p>
        <p>{t("legal.noticeBody2")}</p>
      </div>
    </article>
  );
}
