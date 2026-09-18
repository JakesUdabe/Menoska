"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { readCookiePrefs, writeCookiePrefs } from "@/lib/cookie-consent";
import { toast } from "sonner";

export default function CookiesPage() {
  const t = useT();
  const [analytics, setAnalytics] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const prefs = readCookiePrefs();
    setAnalytics(Boolean(prefs?.analytics));
    setLoaded(true);
  }, []);

  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-4xl font-bold tracking-tight">{t("legal.cookiesTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("legal.lastUpdated")}</p>
      <div className="mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>{t("cookies.essentialDesc")}</p>
        <p>{t("cookies.analyticsDesc")}</p>
        <p>{t("legal.cookiesBody")}</p>
      </div>

      <form
        className="mt-10 space-y-6 rounded-2xl border bg-card p-6"
        onSubmit={(e) => {
          e.preventDefault();
          writeCookiePrefs(analytics);
          toast.success(t("cookies.saved"));
        }}
      >
        <h2 className="font-display text-lg font-semibold">{t("cookies.title")}</h2>
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label>{t("cookies.essential")}</Label>
            <p className="text-xs text-muted-foreground">{t("cookies.essentialDesc")}</p>
          </div>
          <Switch checked disabled aria-readonly />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="analytics">{t("cookies.analytics")}</Label>
            <p className="text-xs text-muted-foreground">{t("cookies.analyticsDesc")}</p>
          </div>
          <Switch id="analytics" checked={analytics} onCheckedChange={setAnalytics} disabled={!loaded} />
        </div>
        <Button type="submit">{t("cookies.save")}</Button>
      </form>
    </article>
  );
}
