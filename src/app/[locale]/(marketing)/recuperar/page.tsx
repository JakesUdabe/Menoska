"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useT } from "@/i18n/provider";
import { withLocale } from "@/lib/paths";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function RecoverPasswordPage() {
  const t = useT();
  const { locale } = useLocale();
  const { requestPasswordReset, demo } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(formData: FormData) {
    setError(null);
    setBusy(true);
    const email = String(formData.get("email") ?? "");
    const result = await requestPasswordReset(email);
    setBusy(false);
    if (result.demo) {
      toast.message(t("auth.resetDemoHint"));
      return;
    }
    if (result.error) {
      setError(result.error.startsWith("auth.") ? t(result.error) : result.error);
      return;
    }
    setSent(true);
    toast.success(t("auth.resetSent"));
  }

  return (
    <div className="mesh-hero mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-3xl font-bold tracking-tight">{t("auth.resetTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("auth.resetLead")}</p>
      {demo ? (
        <p className="mt-2 text-xs text-muted-foreground">{t("auth.resetDemoHint")}</p>
      ) : null}
      {sent ? (
        <p className="mt-6 rounded-xl bg-accent p-4 text-sm">{t("auth.resetSent")}</p>
      ) : (
        <form
          className="mt-8 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmit(new FormData(e.currentTarget));
          }}
        >
          <div>
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={busy}>
            {t("auth.resetSubmit")}
          </Button>
        </form>
      )}
      <p className="mt-6 text-sm text-muted-foreground">
        <Link className="underline" href={withLocale(locale, "/login")}>
          {t("nav.login")}
        </Link>
      </p>
    </div>
  );
}
