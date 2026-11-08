import Link from "next/link";
import { isLocale, type Locale } from "@/i18n/locales";
import { createTranslator } from "@/i18n/server";
import { withLocale } from "@/lib/paths";
import { Button } from "@/components/ui/button";
import { SupportTicketPanel } from "@/components/support-ticket-panel";

export default async function SoportePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "es") as Locale;
  const t = createTranslator(locale);

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{t("support.eyebrow")}</p>
      <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-ink">{t("support.title")}</h1>
      <p className="mt-4 text-lg text-muted-foreground">{t("support.lead")}</p>

      <div className="mt-10 space-y-6 rounded-2xl border border-border bg-card p-6">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">{t("support.contactTitle")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("support.contactBody")}</p>
          <p className="mt-3 font-mono text-sm text-primary">
            <a className="hover:underline" href="mailto:soporte@menoska.com">
              soporte@menoska.com
            </a>
          </p>
        </div>
        <SupportTicketPanel />
        <div className="border-t border-border pt-6">
          <h2 className="font-display text-lg font-semibold text-ink">{t("support.slaTitle")}</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>{t("support.sla1")}</li>
            <li>{t("support.sla2")}</li>
            <li>{t("support.sla3")}</li>
          </ul>
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button asChild>
            <Link href={withLocale(locale, "/contacto")}>{t("nav.contact")}</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={withLocale(locale, "/estado")}>{t("footer.status")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
