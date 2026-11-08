"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useLocale, useT } from "@/i18n/provider";
import { canManageOrgUsers } from "@/lib/rbac";
import { demoApiHeaders } from "@/lib/api/demo-headers";
import { listDemoPendingForOrg, upsertDemoInvite, type OrgInvite } from "@/lib/invites-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { withLocale } from "@/lib/paths";
import { useRouter } from "next/navigation";

export default function EquipoPage() {
  const t = useT();
  const { locale } = useLocale();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"client" | "admin">("client");
  const [invites, setInvites] = useState<OrgInvite[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const res = await fetch("/api/invites", {
      headers: { ...demoApiHeaders(user) },
    });
    if (!res.ok) return;
    const data = (await res.json()) as { invites?: OrgInvite[] };
    const fromApi = data.invites ?? [];
    fromApi.forEach((inv) => upsertDemoInvite(inv));
    const local = user.organizationId ? listDemoPendingForOrg(user.organizationId) : [];
    const byId = new Map<string, OrgInvite>();
    [...fromApi, ...local].forEach((inv) => byId.set(inv.id, inv));
    setInvites([...byId.values()]);
  }, [user]);

  useEffect(() => {
    if (!loading && user && !canManageOrgUsers(user.role)) {
      router.replace(withLocale(locale, "/dashboard"));
    }
  }, [loading, user, locale, router]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || !user || !canManageOrgUsers(user.role)) {
    return <div className="text-sm text-muted-foreground">{t("common.loading")}</div>;
  }

  const currentUser = user;

  async function onInvite() {
    if (!email.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "content-type": "application/json", ...demoApiHeaders(currentUser) },
        body: JSON.stringify({
          email: email.trim(),
          role,
          organizationId: currentUser.organizationId,
          organizationName: currentUser.organizationName,
        }),
      });
      const data = (await res.json()) as { invite?: OrgInvite; acceptPath?: string; error?: string };
      if (!res.ok || !data.invite) {
        toast.error(data.error ?? t("team.error"));
        return;
      }
      upsertDemoInvite(data.invite);
      toast.success(t("team.sent"));
      setEmail("");
      await load();
      if (data.acceptPath) {
        const url = typeof window !== "undefined" ? `${window.location.origin}${withLocale(locale, data.acceptPath)}` : data.acceptPath;
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          /* ignore */
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">{t("team.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("team.lead")}</p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="invite-email">{t("team.email")}</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colega@empresa.com"
          />
        </div>
        <div>
          <Label htmlFor="invite-role">{t("team.role")}</Label>
          <select
            id="invite-role"
            className="mt-1 flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value as "client" | "admin")}
          >
            <option value="client">client</option>
            <option value="admin">admin</option>
          </select>
        </div>
        <Button disabled={busy} onClick={() => void onInvite()}>
          {t("team.invite")}
        </Button>
      </div>

      <div className="space-y-3 border-t pt-6">
        <h2 className="font-display text-lg font-semibold">{t("team.pending")}</h2>
        {!invites.length ? (
          <div className="rounded-xl border border-dashed border-border bg-card/40 px-5 py-8 text-center">
            <p className="text-sm text-muted-foreground">{t("team.empty")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("team.emptyHint")}</p>
            <Button
              className="mt-4"
              type="button"
              variant="outline"
              onClick={() => document.getElementById("invite-email")?.focus()}
            >
              {t("team.emptyCta")}
            </Button>
          </div>
        ) : (
          <ul className="space-y-2 text-sm">
            {invites.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border px-3 py-2">
                <span>
                  {inv.email} · {inv.role}
                </span>
                <a
                  className="text-xs text-primary underline-offset-2 hover:underline"
                  href={withLocale(locale, `/invitar?token=${inv.token}`)}
                >
                  /invitar?token=…
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
