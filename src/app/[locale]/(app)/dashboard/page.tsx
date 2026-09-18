"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, LineChart, Newspaper, Plus, Radio, Shield } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useLocale, useT } from "@/i18n/provider";
import { withLocale } from "@/lib/paths";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isOrgAdmin } from "@/lib/rbac";
import { listBulletinsForUser, type StoredBulletin } from "@/lib/bulletins-store";
import { listReportsForUser } from "@/lib/reports/reports-store";
import { KIND_PATH, type StoredReport } from "@/lib/reports/types";

export default function DashboardHomePage() {
  const t = useT();
  const { locale } = useLocale();
  const { user } = useAuth();
  const [bulletins, setBulletins] = useState<StoredBulletin[]>([]);
  const [reports, setReports] = useState<StoredReport[]>([]);
  const seeOrg = isOrgAdmin(user?.role);

  useEffect(() => {
    if (!user) return;
    setBulletins(listBulletinsForUser(user.id, user.organizationId, seeOrg).slice(0, 4));
    setReports(listReportsForUser(user.id, user.organizationId, seeOrg).slice(0, 4));
  }, [user, seeOrg]);

  const tools = [
    { href: "/dashboard/boletines", title: t("tools.bulletins"), lead: t("tools.bulletinsLead"), icon: Newspaper },
    { href: "/dashboard/estado-del-arte", title: t("tools.estadoArte"), lead: t("tools.estadoArteLead"), icon: BookOpen },
    { href: "/dashboard/informe-mercado", title: t("tools.informeMercado"), lead: t("tools.informeMercadoLead"), icon: LineChart },
    { href: "/dashboard/social-listening", title: t("tools.socialListening"), lead: t("tools.socialLead"), icon: Radio },
  ];

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">{t("dashboard.homeTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("dashboard.org")} {user?.organizationName ?? "—"} · {user?.plan}
          </p>
        </div>
        {seeOrg ? (
          <Button variant="outline" asChild>
            <Link href={withLocale(locale, "/admin")}>
              <Shield className="size-4" /> {t("sidebar.adminPanel")}
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tools.map((tool) => (
          <Link key={tool.href} href={withLocale(locale, tool.href)} className="group">
            <Card className="h-full transition-colors group-hover:border-signal">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <tool.icon className="size-5" />
                </div>
                <CardTitle className="text-base">{tool.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{tool.lead}</CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">{t("dashboard.recentBulletins")}</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href={withLocale(locale, "/dashboard/boletines/nuevo")}>
              <Plus className="size-4" /> {t("dashboard.newBulletin")}
            </Link>
          </Button>
        </div>
        {bulletins.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("dashboard.empty")}</p>
        ) : (
          <ul className="space-y-2">
            {bulletins.map((b) => (
              <li key={b.id}>
                <Link href={withLocale(locale, `/dashboard/boletines/${b.id}`)} className="block rounded-xl border bg-card p-4 hover:border-signal">
                  <p className="font-medium">{b.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {b.status} · {t(`bulletin.${b.frequency}`)} · {b.language}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-semibold">{t("dashboard.recentReports")}</h2>
        {reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("tools.empty")}</p>
        ) : (
          <ul className="space-y-2">
            {reports.map((r) => (
              <li key={r.id}>
                <Link href={withLocale(locale, `${KIND_PATH[r.kind]}/${r.id}`)} className="block rounded-xl border bg-card p-4 hover:border-signal">
                  <p className="font-medium">{r.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {t(`tools.${r.kind === "estado_arte" ? "estadoArte" : r.kind === "informe_mercado" ? "informeMercado" : "socialListening"}`)} · {t(`tools.status.${r.status}`)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
