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
import { DEMO_PROFILES } from "@/lib/demo-data";
import { defaultAppRoute } from "@/lib/rbac";

export default function LoginPage() {
  const t = useT();
  const { locale } = useLocale();
  const { signIn, demo, setDemoUser } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const result = await signIn(email, password);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push(withLocale(locale, "/dashboard"));
  }

  return (
    <div className="mesh-hero mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-3xl font-bold tracking-tight">{t("auth.loginTitle")}</h1>
      {demo ? <p className="mt-2 text-xs text-signal">{t("common.demo")}</p> : null}
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
        <div>
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Input id="password" name="password" type="password" required autoComplete="current-password" />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full">
          {t("auth.submitLogin")}
        </Button>
      </form>
      {demo ? (
        <div className="mt-6 space-y-2">
          {DEMO_PROFILES.map((p) => (
            <Button
              key={p.id}
              type="button"
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                setDemoUser(p);
                router.push(withLocale(locale, defaultAppRoute(p.role)));
              }}
            >
              {p.role} · {p.email}
            </Button>
          ))}
        </div>
      ) : null}
      <p className="mt-6 text-sm text-muted-foreground">
        {t("auth.noAccount")}{" "}
        <Link className="underline" href={withLocale(locale, "/registro")}>
          {t("nav.register")}
        </Link>
      </p>
    </div>
  );
}
