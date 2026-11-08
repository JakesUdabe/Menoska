"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useT } from "@/i18n/provider";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { withLocale } from "@/lib/paths";
import { findDemoInviteByToken } from "@/lib/invites-store";
import { acceptInvite } from "@/lib/invites-repository";
import type { DemoProfile } from "@/lib/demo-data";

type Preview = {
  email: string;
  role: string;
  organizationName: string | null;
  expiresAt: string;
  token: string;
};

function InviteAcceptForm() {
  const t = useT();
  const { locale } = useLocale();
  const { demo, setDemoUser, user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token")?.trim() ?? "";
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("demo1234");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("invite_invalid");
      return;
    }
    void fetch(`/api/invites?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (res.ok) {
          setPreview((await res.json()) as Preview);
          return;
        }
        const local = findDemoInviteByToken(token);
        if (local && !local.acceptedAt && new Date(local.expiresAt) > new Date()) {
          setPreview({
            email: local.email,
            role: local.role,
            organizationName: local.organizationName ?? null,
            expiresAt: local.expiresAt,
            token: local.token,
          });
          return;
        }
        setError("invite_invalid");
      })
      .catch(() => {
        const local = findDemoInviteByToken(token);
        if (local && !local.acceptedAt && new Date(local.expiresAt) > new Date()) {
          setPreview({
            email: local.email,
            role: local.role,
            organizationName: local.organizationName ?? null,
            expiresAt: local.expiresAt,
            token: local.token,
          });
          return;
        }
        setError("invite_invalid");
      });
  }, [token]);

  async function onAccept() {
    if (!token) return;
    setBusy(true);
    try {
      if (demo) {
        const result = await acceptInvite({
          token,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          password: password || undefined,
        });
        if (result.demoAccount) {
          setDemoUser(result.demoAccount.profile as DemoProfile);
        }
        toast.success(t("team.acceptOk"));
        router.push(withLocale(locale, "/dashboard"));
        return;
      }

      const res = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        toast.error(t("team.acceptError"));
        return;
      }
      toast.success(t("team.acceptOk"));
      router.push(withLocale(locale, "/dashboard"));
    } catch {
      toast.error(t("team.acceptError"));
    } finally {
      setBusy(false);
    }
  }

  if (error || (!preview && !token)) {
    return (
      <div className="mesh-hero mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold">{t("team.acceptTitle")}</h1>
        <p className="mt-3 text-sm text-destructive">{t("team.acceptError")}</p>
      </div>
    );
  }

  if (!preview) {
    return <div className="p-8 text-sm text-muted-foreground">{t("common.loading")}</div>;
  }

  return (
    <div className="mesh-hero mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-3xl font-bold tracking-tight">{t("team.acceptTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("team.acceptLead")}</p>
      <dl className="mt-6 space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{t("auth.email")}</dt>
          <dd className="font-medium">{preview.email}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{t("team.org")}</dt>
          <dd className="font-medium">{preview.organizationName ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{t("team.role")}</dt>
          <dd className="font-medium">{preview.role}</dd>
        </div>
      </dl>

      {demo ? (
        <div className="mt-6 space-y-3">
          <div>
            <Label htmlFor="fn">{t("team.name")}</Label>
            <Input id="fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ln">{t("profile.lastName")}</Label>
            <Input id="ln" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="pw">{t("team.password")}</Label>
            <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </div>
      ) : !user ? (
        <p className="mt-6 text-sm text-muted-foreground">
          <a className="text-primary underline-offset-2 hover:underline" href={withLocale(locale, "/login")}>
            {t("auth.loginTitle")}
          </a>
        </p>
      ) : null}

      <Button
        className="mt-8 w-full"
        disabled={busy || (!demo && !user)}
        onClick={() => void onAccept()}
      >
        {t("team.accept")}
      </Button>
    </div>
  );
}

export default function InvitarPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">…</div>}>
      <InviteAcceptForm />
    </Suspense>
  );
}
