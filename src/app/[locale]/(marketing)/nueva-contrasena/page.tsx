"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useT } from "@/i18n/provider";
import { withLocale } from "@/lib/paths";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function NewPasswordPage() {
  const t = useT();
  const { locale } = useLocale();
  const { updatePasswordFromRecovery, demo } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(formData: FormData) {
    setError(null);
    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirm") ?? "");
    if (password.length < 8) {
      setError(t("auth.passwordMin"));
      return;
    }
    if (password !== confirm) {
      setError(t("auth.passwordMismatch"));
      return;
    }
    if (demo) {
      toast.message(t("auth.resetDemoHint"));
      return;
    }
    setBusy(true);
    const result = await updatePasswordFromRecovery(password);
    setBusy(false);
    if (result.error) {
      setError(result.error === "min_8" ? t("auth.passwordMin") : result.error);
      return;
    }
    toast.success(t("auth.passwordUpdated"));
    router.push(withLocale(locale, "/login"));
  }

  return (
    <div className="mesh-hero mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-3xl font-bold tracking-tight">{t("auth.newPasswordTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("auth.newPasswordLead")}</p>
      <form
        className="mt-8 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit(new FormData(e.currentTarget));
        }}
      >
        <div>
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
        </div>
        <div>
          <Label htmlFor="confirm">{t("auth.confirmPassword")}</Label>
          <Input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={busy}>
          {t("auth.savePassword")}
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        <Link className="underline" href={withLocale(locale, "/login")}>
          {t("nav.login")}
        </Link>
      </p>
    </div>
  );
}
