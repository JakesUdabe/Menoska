"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useLocale, useT } from "@/i18n/provider";
import { withLocale } from "@/lib/paths";
import { Button } from "@/components/ui/button";
import { isOrgAdmin, maxActiveBulletins } from "@/lib/rbac";
import { listBulletinsForUser, type StoredBulletin } from "@/lib/bulletins-repository";

export default function BulletinsPage() {
  const t = useT();
  const { locale } = useLocale();
  const { user } = useAuth();
  const [items, setItems] = useState<StoredBulletin[]>([]);
  const cap = maxActiveBulletins(user?.plan);
  const seeOrg = isOrgAdmin(user?.role);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void listBulletinsForUser(user.id, user.organizationId, seeOrg).then((rows) => {
      if (!cancelled) setItems(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [user, seeOrg]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">{t("dashboard.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("tools.bulletinsLead")}
            {cap ? ` · ${t("dashboard.max")} ${cap}` : null}
          </p>
        </div>
        <Button asChild>
          <Link href={withLocale(locale, "/dashboard/boletines/nuevo")}>
            <Plus className="size-4" /> {t("dashboard.newBulletin")}
          </Link>
        </Button>
      </div>
      <ul className="mt-8 space-y-3">
        {items.length === 0 ? (
          <li className="rounded-xl border border-dashed border-border bg-card/40 px-5 py-8 text-center">
            <p className="text-sm text-muted-foreground">{t("dashboard.empty")}</p>
            <Button className="mt-4" asChild>
              <Link href={withLocale(locale, "/dashboard/boletines/nuevo")}>
                <Plus className="size-4" /> {t("dashboard.onboardingBulletinCta")}
              </Link>
            </Button>
          </li>
        ) : null}
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
