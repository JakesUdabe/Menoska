"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, FolderKanban, LineChart, Newspaper, Plus, Search, Shield } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useLocale, useT } from "@/i18n/provider";
import { withLocale } from "@/lib/paths";
import { Button } from "@/components/ui/button";
import { isOrgAdmin } from "@/lib/rbac";
import { listBulletinsForUser, type StoredBulletin } from "@/lib/bulletins-repository";
import { listReportsForUser } from "@/lib/reports/reports-repository";
import { KIND_PATH, type StoredReport } from "@/lib/reports/types";
import { listRecentActivity, type ActivityEvent } from "@/lib/activity";
import { listProjectsForUser, type StoredProject } from "@/lib/projects-repository";
import { SHOWCASE_PROJECT_ID } from "@/lib/showcase-case";
import { AiUsageStrip } from "@/components/ai-usage-panel";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { HappyPathWizard } from "@/components/happy-path-wizard";
import { NpsSurvey } from "@/components/nps-survey";

export default function DashboardHomePage() {
  const t = useT();
  const { locale } = useLocale();
  const { user } = useAuth();
  const [bulletins, setBulletins] = useState<StoredBulletin[]>([]);
  const [reports, setReports] = useState<StoredReport[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [projects, setProjects] = useState<StoredProject[]>([]);
  const seeOrg = isOrgAdmin(user?.role);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      const [b, r, a, p] = await Promise.all([
        listBulletinsForUser(user.id, user.organizationId, seeOrg),
        listReportsForUser(user.id, user.organizationId, seeOrg),
        listRecentActivity({ organizationId: user.organizationId, userId: user.id, limit: 5 }),
        listProjectsForUser(user.id, user.organizationId, seeOrg),
      ]);
      if (cancelled) return;
      setBulletins(b.slice(0, 4));
      setReports(r.slice(0, 4));
      setActivity(a);
      setProjects(p);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, seeOrg]);

  const featured = projects.find((project) => project.id === SHOWCASE_PROJECT_ID) ?? projects[0];
  const flow = [
    { href: "/dashboard/boletines", title: t("tools.bulletins"), icon: Newspaper },
    { href: "/dashboard/modulos/scouting/patentes-fto", title: t("tools.patentesFto"), icon: Search },
    { href: "/dashboard/estado-del-arte", title: t("tools.estadoArte"), icon: BookOpen },
    { href: "/dashboard/informe-mercado", title: t("tools.informeMercado"), icon: LineChart },
  ];

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink">{t("dashboard.homeTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("dashboard.homeLead")}</p>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>
              {t("dashboard.org")} {user?.organizationName ?? "—"}
            </span>
            {user?.plan ? (
              <span className="rounded-md border border-border bg-secondary/50 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide text-foreground">
                {user.plan}
              </span>
            ) : null}
          </p>
        </div>
        {seeOrg || user?.role === "empleado" ? (
          <Button variant="outline" asChild>
            <Link href={withLocale(locale, "/admin")}>
              <Shield className="size-4" /> {t("sidebar.adminPanel")}
            </Link>
          </Button>
        ) : null}
      </div>

      <HappyPathWizard />
      <OnboardingChecklist />

      <section className="rounded-xl border border-border bg-card p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">{t("dashboard.caseEyebrow")}</p>
        <h2 className="mt-1 font-display text-xl font-semibold text-ink">{featured?.name ?? t("dashboard.caseFallback")}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{featured?.description ?? t("dashboard.homeLead")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {featured ? (
            <Button asChild>
              <Link href={withLocale(locale, `/dashboard/proyectos/${featured.id}`)}>
                <FolderKanban className="size-4" /> {t("dashboard.caseCta")}
              </Link>
            </Button>
          ) : null}
          {flow.map((step) => (
            <Button key={step.href} variant="outline" asChild>
              <Link href={withLocale(locale, step.href)}>
                <step.icon className="size-4" /> {step.title}
              </Link>
            </Button>
          ))}
        </div>
      </section>

      <NpsSurvey />

      {user?.plan === "starter" ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-3 text-sm">
          <p className="text-muted-foreground">{t("dashboard.starterTip")}</p>
          <Link href={withLocale(locale, "/dashboard/facturacion")} className="mt-1 inline-block text-sm font-medium text-primary hover:underline">
            {t("billing.upgrade")}
          </Link>
        </div>
      ) : null}

      <AiUsageStrip />

      <section>
        <h2 className="mb-3 font-semibold">{t("dashboard.recentActivity")}</h2>
        {activity.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card/40 px-5 py-6 text-center text-sm text-muted-foreground">
            {t("dashboard.emptyActivity")}
          </p>
        ) : (
          <ul className="space-y-2">
            {activity.map((event) => (
              <li key={event.id} className="rounded-xl border bg-card px-4 py-3 text-sm">
                <p className="font-medium">{event.title}</p>
                <p className="text-xs text-muted-foreground">
                  {event.kind} · {new Date(event.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

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
          <div className="rounded-xl border border-dashed border-border bg-card/40 px-5 py-8 text-center">
            <p className="text-sm text-muted-foreground">{t("dashboard.empty")}</p>
            <Button className="mt-4" asChild>
              <Link href={withLocale(locale, "/dashboard/boletines/nuevo")}>
                <Plus className="size-4" /> {t("dashboard.onboardingBulletinCta")}
              </Link>
            </Button>
          </div>
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
          <div className="rounded-xl border border-dashed border-border bg-card/40 px-5 py-8 text-center">
            <p className="text-sm text-muted-foreground">{t("dashboard.emptyReports")}</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button asChild>
                <Link href={withLocale(locale, "/dashboard/estado-del-arte")}>{t("dashboard.onboardingReportEstado")}</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={withLocale(locale, "/dashboard/informe-mercado")}>{t("dashboard.onboardingReportMercado")}</Link>
              </Button>
            </div>
          </div>
        ) : (
          <ul className="space-y-2">
            {reports.map((r) => (
              <li key={r.id}>
                <Link href={withLocale(locale, `${KIND_PATH[r.kind]}/${r.id}`)} className="block rounded-xl border bg-card p-4 hover:border-signal">
                  <p className="font-medium">{r.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {t(
                      `tools.${r.kind === "estado_arte" ? "estadoArte" : r.kind === "informe_mercado" ? "informeMercado" : "socialListening"}`,
                    )}{" "}
                    · {t(`tools.status.${r.status}`)}
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
