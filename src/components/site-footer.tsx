"use client";

import Link from "next/link";
import { useT, useLocale } from "@/i18n/provider";
import { withLocale } from "@/lib/paths";
import { BrandMark, BrandWordmark } from "@/components/site-header";

export function SiteFooter({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const { locale } = useLocale();
  const year = 2026;

  return (
    <footer className="border-t border-border bg-background">
      <div
        className={`mx-auto flex max-w-6xl flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between ${compact ? "py-4" : "py-10"}`}
      >
        <div className="flex flex-col gap-2">
          {!compact ? (
            <div className="flex items-center gap-2">
              <BrandMark size={22} />
              <BrandWordmark className="text-sm" />
            </div>
          ) : null}
          <p className="font-mono text-[12px] text-muted-foreground">
            © {year} {t("common.brand")}. {t("footer.rights")}
          </p>
          {!compact ? <p className="text-sm text-muted-foreground">{t("common.tagline")}</p> : null}
        </div>
        <nav className="flex flex-wrap gap-4 text-sm" aria-label="Legal">
          <Link href={withLocale(locale, "/privacidad")} className="text-muted-foreground transition-colors hover:text-foreground">
            {t("legal.dataProtection")}
          </Link>
          <Link href={withLocale(locale, "/dpa")} className="text-muted-foreground transition-colors hover:text-foreground">
            {t("footer.dpa")}
          </Link>
          <Link href={withLocale(locale, "/cookies")} className="text-muted-foreground transition-colors hover:text-foreground">
            {t("legal.cookiesTitle")}
          </Link>
          <Link href={withLocale(locale, "/accesibilidad")} className="text-muted-foreground transition-colors hover:text-foreground">
            {t("legal.a11yTitle")}
          </Link>
          <Link href={withLocale(locale, "/aviso-legal")} className="text-muted-foreground transition-colors hover:text-foreground">
            {t("legal.noticeTitle")}
          </Link>
          <Link href={withLocale(locale, "/terminos")} className="text-muted-foreground transition-colors hover:text-foreground">
            {t("legal.termsTitle")}
          </Link>
          <Link href={withLocale(locale, "/soporte")} className="text-muted-foreground transition-colors hover:text-foreground">
            {t("footer.support")}
          </Link>
          <Link href={withLocale(locale, "/estado")} className="text-muted-foreground transition-colors hover:text-foreground">
            {t("footer.status")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
