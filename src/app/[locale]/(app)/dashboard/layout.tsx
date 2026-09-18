"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CreditCard,
  FileText,
  LayoutDashboard,
  LineChart,
  Mail,
  Newspaper,
  Radio,
  Settings,
  Shield,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useLocale, useT } from "@/i18n/provider";
import { withLocale } from "@/lib/paths";
import { isOrgAdmin } from "@/lib/rbac";
import { AppShell, PlanBadge, type ShellNavItem } from "@/components/app-shell";

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

  const items: ShellNavItem[] = [
    { href: withLocale(locale, "/dashboard"), label: t("sidebar.dashboard"), icon: LayoutDashboard, exact: true },
    { href: withLocale(locale, "/dashboard/boletines"), label: t("tools.bulletins"), icon: Newspaper, group: t("sidebar.tools") },
    { href: withLocale(locale, "/dashboard/estado-del-arte"), label: t("tools.estadoArte"), icon: BookOpen, group: t("sidebar.tools") },
    { href: withLocale(locale, "/dashboard/informe-mercado"), label: t("tools.informeMercado"), icon: LineChart, group: t("sidebar.tools") },
    { href: withLocale(locale, "/dashboard/social-listening"), label: t("tools.socialListening"), icon: Radio, group: t("sidebar.tools") },
    { href: withLocale(locale, "/dashboard/tutoriales"), label: t("sidebar.tutorials"), icon: FileText, group: t("sidebar.services") },
    { href: withLocale(locale, "/dashboard/facturacion"), label: t("dashboard.billing"), icon: CreditCard, group: t("sidebar.services") },
    { href: withLocale(locale, "/dashboard/contacto"), label: t("nav.contact"), icon: Mail, group: t("sidebar.services") },
    ...(isOrgAdmin(user.role)
      ? [{ href: withLocale(locale, "/admin"), label: t("sidebar.adminPanel"), icon: Shield, group: t("sidebar.admin") }]
      : []),
  ];

  return (
    <AppShell
      items={items}
      brandHref={withLocale(locale, "/dashboard")}
      brandLabel={
        <span>
          ABI <span className="font-normal text-sidebar-foreground/60">News</span>
        </span>
      }
      planSlot={<PlanBadge plan={user.plan} />}
      headerExtra={
        <Link
          href={withLocale(locale, "/dashboard/perfil")}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          title={t("dashboard.profile")}
        >
          <Settings className="size-5" />
        </Link>
      }
    >
      {children}
    </AppShell>
  );
}
