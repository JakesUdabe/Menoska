"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useT, useLocale } from "@/i18n/provider";
import { Button } from "@/components/ui/button";
import { withLocale } from "@/lib/paths";
import { COOKIE_CONSENT_EVENT, readCookiePrefs, writeCookiePrefs } from "@/lib/cookie-consent";

export function CookieBanner() {
  const t = useT();
  const { locale } = useLocale();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const sync = () => setVisible(!readCookiePrefs());
    sync();
    window.addEventListener(COOKIE_CONSENT_EVENT, sync);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, sync);
  }, []);

  if (!visible) return null;

  return (
    <div role="dialog" aria-live="polite" aria-label={t("cookies.title")} className="fixed inset-x-0 bottom-0 z-[100] p-4">
      <div className="mx-auto max-w-3xl rounded-2xl border bg-background/95 p-5 shadow-xl backdrop-blur-md">
        <h2 className="text-base font-semibold">{t("cookies.title")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t("cookies.body")}{" "}
          <Link href={withLocale(locale, "/privacidad")} className="text-signal underline">
            {t("cookies.privacyLink")}
          </Link>
          {" · "}
          <Link href={withLocale(locale, "/cookies")} className="text-signal underline">
            {t("legal.cookiesTitle")}
          </Link>
          .
        </p>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" asChild>
            <Link href={withLocale(locale, "/cookies")}>{t("cookies.customize")}</Link>
          </Button>
          <Button type="button" variant="outline" onClick={() => writeCookiePrefs(false)}>
            {t("cookies.reject")}
          </Button>
          <Button type="button" variant="outline" onClick={() => writeCookiePrefs(true)}>
            {t("cookies.analyticsOnly")}
          </Button>
          <Button type="button" onClick={() => writeCookiePrefs(true)} className="bg-signal text-signal-foreground hover:bg-signal/90">
            {t("cookies.accept")}
          </Button>
        </div>
      </div>
    </div>
  );
}
