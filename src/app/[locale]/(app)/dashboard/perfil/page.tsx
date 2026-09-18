"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/i18n/locales";
import { useLocale, useT } from "@/i18n/provider";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { withLocale } from "@/lib/paths";

export default function ProfilePage() {
  const t = useT();
  const { locale, setLocale } = useLocale();
  const { user, updateProfile, changePassword, deleteAccount, signOut } = useAuth();
  const router = useRouter();
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [org, setOrg] = useState(user?.organizationName ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  if (!user) return null;

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="font-display text-3xl font-bold tracking-tight">{t("dashboard.profile")}</h1>
      <p className="text-sm text-muted-foreground">{user.email}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="firstName">{t("profile.firstName")}</Label>
          <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="lastName">{t("profile.lastName")}</Label>
          <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
      </div>
      <div>
        <Label>{t("dashboard.org")}</Label>
        <Input value={org} onChange={(e) => setOrg(e.target.value)} />
      </div>
      <div>
        <Label>{t("nav.language")}</Label>
        <select
          className="mt-1 flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
        >
          {LOCALES.map((code) => (
            <option key={code} value={code}>
              {LOCALE_LABELS[code]}
            </option>
          ))}
        </select>
      </div>
      <Button
        onClick={() => {
          void updateProfile({ firstName, lastName, organizationName: org, locale }).then((r) => {
            if (r.error) toast.error(r.error);
            else toast.success(t("profile.updated"));
          });
        }}
      >
        {t("common.save")}
      </Button>

      <div className="space-y-3 border-t pt-6">
        <Label htmlFor="password">{t("profile.passwordNew")}</Label>
        <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Label htmlFor="confirm">{t("profile.passwordConfirm")}</Label>
        <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <Button
          variant="outline"
          onClick={() => {
            if (password !== confirm) {
              toast.error(t("profile.mismatch"));
              return;
            }
            void changePassword(password).then((r) => {
              if (r.error) toast.error(r.error);
              else toast.success(t("profile.updated"));
            });
          }}
        >
          {t("auth.password")}
        </Button>
      </div>

      <Button
        variant="destructive"
        onClick={() => {
          if (!window.confirm(t("profile.deleteConfirm"))) return;
          void deleteAccount().then(async () => {
            await signOut();
            router.replace(withLocale(locale, "/"));
          });
        }}
      >
        {t("dashboard.gdpr")}
      </Button>
    </div>
  );
}
