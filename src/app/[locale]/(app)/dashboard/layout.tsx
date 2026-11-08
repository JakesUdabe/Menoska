"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CreditCard,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LineChart,
  Mail,
  Newspaper,
  Search,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useLocale, useT } from "@/i18n/provider";
import { withLocale } from "@/lib/paths";
import { canManageOrgUsers, isOrgAdmin } from "@/lib/rbac";
import { AppShell, PlanBadge, type ShellNavItem } from "@/components/app-shell";
import { NotificationsBell } from "@/components/notifications-bell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { locale } = useLocale();
  const t = useT();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace(withLocale(locale, "/login"));
  }, [loading, user, locale, router]);

  if (loading || !user) {
    return <div className="p-8 text-sm text-muted-foreground">{t("common.loading")}</div>;
  }

  const flow = t("sidebar.flow");
  const account = t("sidebar.account");
  const items: ShellNavItem[] = [
    { href: withLocale(locale, "/dashboard"), label: t("sidebar.dashboard"), icon: LayoutDashboard, exact: true },
    { href: withLocale(locale, "/dashboard/proyectos"), label: t("projects.title"), icon: FolderKanban, group: flow },
    { href: withLocale(locale, "/dashboard/boletines"), label: t("tools.bulletins"), icon: Newspaper, group: flow },
    {
      href: withLocale(locale, "/dashboard/modulos/scouting/patentes-fto"),
      label: t("tools.patentesFto"),
      icon: Search,
      group: flow,
    },
    { href: withLocale(locale, "/dashboard/estado-del-arte"), label: t("tools.estadoArte"), icon: BookOpen, group: flow },
    { href: withLocale(locale, "/dashboard/informe-mercado"), label: t("tools.informeMercado"), icon: LineChart, group: flow },
    { href: withLocale(locale, "/dashboard/facturacion"), label: t("dashboard.billing"), icon: CreditCard, group: account },
    { href: withLocale(locale, "/dashboard/tutoriales"), label: t("sidebar.tutorials"), icon: FileText, group: account },
    { href: withLocale(locale, "/dashboard/contacto"), label: t("nav.contact"), icon: Mail, group: account },
    ...(canManageOrgUsers(user.role)
      ? [{ href: withLocale(locale, "/dashboard/equipo"), label: t("sidebar.team"), icon: Users, group: account }]
      : []),
    ...(isOrgAdmin(user.role) || user.role === "empleado"
      ? [{ href: withLocale(locale, "/admin"), label: t("sidebar.adminPanel"), icon: Shield, group: account }]
      : []),
  ];

  return (
    <AppShell
      items={items}
      brandHref={withLocale(locale, "/dashboard")}
      brandLabel={
        <span className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mark.svg" alt="" width={26} height={18} className="brightness-0 invert opacity-90" />
          <span className="leading-tight">
            <span className="block text-[13px] font-semibold text-primary">{t("common.brandShort")}</span>
            <span className="block text-[10px] font-normal uppercase tracking-[0.14em] text-sidebar-foreground/55">
              {t("common.brandSuffix")}
            </span>
          </span>
        </span>
      }
      planSlot={<PlanBadge plan={user.plan} />}
      headerExtra={
        <div className="flex items-center gap-2">
          <NotificationsBell />
          <Link
            href={withLocale(locale, "/dashboard/perfil")}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            title={t("dashboard.profile")}
          >
            <Settings className="size-5" />
          </Link>
        </div>
      }
    >
      {children}
    </AppShell>
  );
}
