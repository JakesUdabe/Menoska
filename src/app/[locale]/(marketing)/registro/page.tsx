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
import { extractEmailDomain } from "@/lib/utils";
import { isFreeEmailDomain } from "@/lib/free-email-domains";
import { defaultAppRoute } from "@/lib/rbac";
import { toast } from "sonner";

export default function RegisterPage() {
  const t = useT();
  const { locale } = useLocale();
  const { signUp, demo, resendVerificationEmail } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [needsOrg, setNeedsOrg] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [resending, setResending] = useState(false);

  async function onSubmit(formData: FormData) {
    const email = String(formData.get("email") ?? "");
    const domain = extractEmailDomain(email);
    if (domain && isFreeEmailDomain(domain) && !needsOrg) {
      setNeedsOrg(true);
      setError(t("auth.freeEmailError"));
      return;
    }
    const result = await signUp({
      email,
      password: String(formData.get("password") ?? ""),
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      organizationName: String(formData.get("organizationName") ?? ""),
    });
    if (result.error) {
      setError(result.error.startsWith("auth.") ? t(result.error) : result.error);
      return;
    }
    if (result.needsVerification) {
      setPendingEmail(email.trim().toLowerCase());
      setOk(true);
      return;
    }
    router.push(withLocale(locale, defaultAppRoute("client")));
  }

  async function onResend() {
    if (!pendingEmail) return;
    setResending(true);
    const result = await resendVerificationEmail(pendingEmail);
    setResending(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(t("auth.resendOk"));
  }

  return (
    <div className="mesh-hero mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-3xl font-bold tracking-tight">{t("auth.registerTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("auth.corporateHint")}</p>
      {demo ? (
        <p className="mt-2 text-xs text-muted-foreground">{t("auth.demoSignupHint")}</p>
      ) : null}
      {ok ? (
        <div className="mt-6 space-y-4 rounded-xl bg-accent p-4 text-sm">
          <p>{t("auth.checkEmail")}</p>
          <Button type="button" variant="outline" size="sm" disabled={resending} onClick={() => void onResend()}>
            {t("auth.resendVerification")}
          </Button>
        </div>
      ) : (
        <form
          className="mt-8 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmit(new FormData(e.currentTarget));
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="firstName">{t("profile.firstName")}</Label>
              <Input id="firstName" name="firstName" required autoComplete="given-name" />
            </div>
            <div>
              <Label htmlFor="lastName">{t("profile.lastName")}</Label>
              <Input id="lastName" name="lastName" required autoComplete="family-name" />
            </div>
          </div>
          <div>
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          {needsOrg ? (
            <div>
              <Label htmlFor="organizationName">{t("auth.orgName")}</Label>
              <Input id="organizationName" name="organizationName" required />
            </div>
          ) : null}
          <div>
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full">
            {t("auth.submitRegister")}
          </Button>
        </form>
      )}
      <p className="mt-6 text-sm text-muted-foreground">
        {t("auth.hasAccount")}{" "}
        <Link className="underline" href={withLocale(locale, "/login")}>
          {t("nav.login")}
        </Link>
      </p>
    </div>
  );
}
