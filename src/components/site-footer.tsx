"use client";

import Link from "next/link";
import { useT, useLocale } from "@/i18n/provider";
import { withLocale } from "@/lib/paths";

export function SiteFooter() {
  const t = useT();
  const { locale } = useLocale();
  const year = 2026;

  return (
    <footer className="border-t border-primary/10 bg-gradient-to-r from-primary/5 via-muted/40 to-signal/10">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-display text-sm font-medium text-foreground/80">
          © {year} {t("common.brand")}. {t("footer.rights")}
        </p>
        <nav className="flex flex-wrap gap-4 text-sm" aria-label="Legal">
          <Link href={withLocale(locale, "/privacidad")} className="font-medium text-muted-foreground transition-colors hover:text-primary">
            {t("legal.dataProtection")}
          </Link>
          <Link href={withLocale(locale, "/cookies")} className="font-medium text-muted-foreground transition-colors hover:text-primary">
            {t("legal.cookiesTitle")}
          </Link>
          <Link href={withLocale(locale, "/accesibilidad")} className="font-medium text-muted-foreground transition-colors hover:text-primary">
            {t("legal.a11yTitle")}
          </Link>
          <Link href={withLocale(locale, "/aviso-legal")} className="font-medium text-muted-foreground transition-colors hover:text-primary">
            {t("legal.noticeTitle")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
