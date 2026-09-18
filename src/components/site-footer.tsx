"use client";

import Link from "next/link";
import { useT, useLocale } from "@/i18n/provider";
import { withLocale } from "@/lib/paths";

export function SiteFooter({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const { locale } = useLocale();
  const year = 2026;

  return (
    <footer className="border-t border-border bg-background">
      <div className={`mx-auto flex max-w-6xl flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between ${compact ? "py-4" : "py-10"}`}>
        <p className="font-mono text-[12px] text-muted-foreground">
          © {year} {t("common.brand")}. {t("footer.rights")}
        </p>
        <nav className="flex flex-wrap gap-4 text-sm" aria-label="Legal">
          <Link href={withLocale(locale, "/privacidad")} className="text-muted-foreground transition-colors hover:text-foreground">
            {t("legal.dataProtection")}
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
        </nav>
      </div>
    </footer>
  );
}
