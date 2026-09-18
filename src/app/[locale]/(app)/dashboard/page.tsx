"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Shield } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useLocale, useT } from "@/i18n/provider";
import { withLocale } from "@/lib/paths";
import { Button } from "@/components/ui/button";
import { isOrgAdmin, maxActiveBulletins } from "@/lib/rbac";
import { listBulletinsForUser, type StoredBulletin } from "@/lib/bulletins-store";

export default function DashboardHomePage() {
  const t = useT();
  const { locale } = useLocale();
  const { user } = useAuth();
  const [items, setItems] = useState<StoredBulletin[]>([]);
  const cap = maxActiveBulletins(user?.plan);
  const seeOrg = isOrgAdmin(user?.role);

  useEffect(() => {
    if (!user) return;
    setItems(listBulletinsForUser(user.id, user.organizationId, seeOrg));
  }, [user, seeOrg]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">{t("dashboard.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("dashboard.org")} {user?.organizationName ?? "—"}
            {cap ? ` · ${t("dashboard.max")} ${cap}` : null}
          </p>
        </div>
        <div className="flex gap-2">
          {seeOrg ? (
            <Button variant="outline" asChild>
              <Link href={withLocale(locale, "/admin")}>
                <Shield className="size-4" /> {t("admin.panel")}
              </Link>
            </Button>
          ) : null}
          <Button asChild>
            <Link href={withLocale(locale, "/dashboard/boletines/nuevo")}>
              <Plus className="size-4" /> {t("dashboard.newBulletin")}
            </Link>
          </Button>
        </div>
      </div>
      <ul className="mt-8 space-y-3">
        {items.length === 0 ? <p>{t("dashboard.empty")}</p> : null}
        {items.map((b) => (
          <li key={b.id}>
            <Link href={withLocale(locale, `/dashboard/boletines/${b.id}`)} className="block rounded-xl border bg-card p-4 hover:border-signal">
              <p className="font-medium">{b.name}</p>
              <p className="text-sm text-muted-foreground">
                {b.subject} · {b.status} · {t(`bulletin.${b.frequency}`)} · {b.language} · {b.recipients.length} {t("dashboard.recipientsShort")}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
