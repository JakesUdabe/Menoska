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
import { defaultAppRoute } from "@/lib/rbac";

export default function LoginPage() {
  const t = useT();
  const { locale } = useLocale();
  const { signIn, demo } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    const identifier = String(formData.get(demo ? "username" : "email") ?? "");
    const password = String(formData.get("password") ?? "");
    const result = await signIn(identifier, password);
    if (result.error) {
      setError(t(result.error));
      return;
    }
    router.push(withLocale(locale, defaultAppRoute(result.role)));
  }

  return (
    <div className="mesh-hero mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-3xl font-bold tracking-tight">{t("auth.loginTitle")}</h1>
      <form
        className="mt-8 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit(new FormData(e.currentTarget));
        }}
      >
        {demo ? (
          <div>
            <Label htmlFor="username">{t("auth.username")}</Label>
            <Input id="username" name="username" type="text" required autoComplete="username" />
          </div>
        ) : (
          <div>
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
        )}
        <div>
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Input id="password" name="password" type="password" required autoComplete="current-password" />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full">
          {t("auth.submitLogin")}
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        {t("auth.noAccount")}{" "}
        <Link className="underline" href={withLocale(locale, "/registro")}>
          {t("nav.register")}
        </Link>
      </p>
    </div>
  );
}
