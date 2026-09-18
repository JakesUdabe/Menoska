"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  CalendarDays,
  FileStack,
  Gauge,
  LayoutDashboard,
  Receipt,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useLocale, useT } from "@/i18n/provider";
import { withLocale } from "@/lib/paths";
import { isOrgAdmin, isSuperAdmin } from "@/lib/rbac";
import { AppShell, type ShellNavItem } from "@/components/app-shell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { locale } = useLocale();
  const t = useT();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || !isOrgAdmin(user.role))) {
      router.replace(withLocale(locale, user ? "/dashboard" : "/login"));
    }
  }, [loading, user, locale, router]);

  if (loading || !user || !isOrgAdmin(user.role)) {
    return <div className="p-8 text-sm text-muted-foreground">{t("common.loading")}</div>;
  }

  const items: ShellNavItem[] = [
    { href: withLocale(locale, "/admin"), label: t("admin.title"), icon: Gauge, exact: true },
    { href: withLocale(locale, "/dashboard"), label: t("admin.backToDashboard"), icon: LayoutDashboard },
    ...(isSuperAdmin(user.role)
      ? [{ href: withLocale(locale, "/admin/plantillas"), label: t("admin.templates"), icon: FileStack }]
      : []),
    { href: withLocale(locale, "/admin/organizaciones"), label: t("admin.orgs"), icon: Building2 },
    { href: withLocale(locale, "/admin/calendario"), label: t("admin.calendar"), icon: CalendarDays },
    { href: withLocale(locale, "/admin/facturacion"), label: t("admin.billing"), icon: Receipt },
  ];

  return (
    <AppShell
      items={items}
      brandHref={withLocale(locale, "/admin")}
      brandLabel={
        <span>
          {t("common.brand")} <span className="font-normal text-sidebar-foreground/60">{t("admin.brandAdmin")}</span>
        </span>
      }
      headerExtra={
        <>
          <Badge variant="outline" className="text-xs font-medium">
            {user.role}
          </Badge>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary">
            {t("admin.adminMode")}
          </span>
        </>
      }
    >
      {children}
    </AppShell>
  );
}
