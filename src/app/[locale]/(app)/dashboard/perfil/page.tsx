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
import { demoApiHeaders } from "@/lib/api/demo-headers";
import { listBulletinsForUser } from "@/lib/bulletins-store";
import { listReportsForUser } from "@/lib/reports/reports-store";
import { readMigratedStorage } from "@/lib/storage-keys";

export default function ProfilePage() {
  const t = useT();
  const { locale, setLocale } = useLocale();
  const { user, demo, updateProfile, changePassword, deleteAccount, signOut } = useAuth();
  const router = useRouter();
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [org, setOrg] = useState(user?.organizationName ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [exporting, setExporting] = useState(false);

  if (!user) return null;

  async function exportMyData() {
    const session = user;
    if (!session) return;
    setExporting(true);
    try {
      const headers: Record<string, string> = { ...demoApiHeaders(session) };
      if (demo) {
        let worksheets: Record<string, unknown> = {};
        try {
          const raw = readMigratedStorage("menoska_worksheets", "abi_worksheets");
          if (raw) worksheets = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          worksheets = {};
        }
        const payload = {
          bulletins: listBulletinsForUser(session.id, session.organizationId, false),
          reports: listReportsForUser(session.id, session.organizationId, false),
          worksheets,
        };
        headers["x-demo-export"] = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
      }
      const res = await fetch("/api/me/export", { headers });
      if (!res.ok) {
        toast.error(t("profile.exportError"));
        return;
      }
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `menoska-export-${session.id.slice(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("profile.exportDone"));
    } catch {
      toast.error(t("profile.exportError"));
    } finally {
      setExporting(false);
    }
  }

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

      <div className="space-y-3 border-t pt-6">
        <p className="text-sm text-muted-foreground">{t("profile.exportLead")}</p>
        <Button type="button" variant="outline" disabled={exporting} onClick={() => void exportMyData()}>
          {exporting ? t("common.loading") : t("profile.export")}
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
