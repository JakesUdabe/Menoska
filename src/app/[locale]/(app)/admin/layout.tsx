"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Building2,
  CalendarDays,
  DollarSign,
  FileStack,
  FolderOpen,
  Gauge,
  LayoutDashboard,
  Receipt,
  ScrollText,
  UserCog,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/auth-provider";
import { AppShell, type ShellNavItem } from "@/components/app-shell";
import { useLocale, useT } from "@/i18n/provider";
import {
  getAccessibleModules,
  getDefaultAdminRoute,
  MODULE_ROUTES,
  type AdminModule,
} from "@/lib/admin/rbac";
import { isSuperAdmin } from "@/lib/rbac";
import { pathWithoutLocale, withLocale } from "@/lib/paths";

const MODULE_ICONS = {
  crm: Users,
  finanzas: DollarSign,
  calendario: CalendarDays,
  documentos: FolderOpen,
  empleados: UserCog,
} as const;

const LEGACY_PREFIXES = [
  "/admin/plantillas",
  "/admin/organizaciones",
  "/admin/envios",
  "/admin/facturacion",
  "/admin/auditoria",
  "/admin/analytics",
  "/admin/arr",
];

function isLegacyPath(path: string) {
  return LEGACY_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function isModulePath(path: string) {
  return (Object.values(MODULE_ROUTES) as string[]).some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { locale } = useLocale();
  const t = useT();
  const router = useRouter();
  const pathname = pathWithoutLocale(usePathname() ?? "/");
  const staff = user?.role === "superadmin" || user?.role === "empleado";
  const orgAdmin = user?.role === "admin";
  const access = user
    ? { role: user.role, employee_permissions: user.employeePermissions }
    : null;

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(withLocale(locale, "/login"));
      return;
    }
    if (!staff && !orgAdmin) {
      router.replace(withLocale(locale, "/dashboard"));
      return;
    }
    if (user.role === "empleado" && (pathname === "/admin" || isLegacyPath(pathname) || !isModulePath(pathname))) {
      if (pathname !== "/admin" && !isModulePath(pathname)) {
        router.replace(withLocale(locale, getDefaultAdminRoute(access)));
      }
    }
    if (orgAdmin && isModulePath(pathname)) {
      router.replace(withLocale(locale, "/admin"));
    }
  }, [loading, locale, orgAdmin, pathname, router, staff, user]);

  if (loading || !user || (!staff && !orgAdmin)) {
    return <div className="p-8 text-sm text-muted-foreground">{t("common.loading")}</div>;
  }

  const moduleItems: ShellNavItem[] = getAccessibleModules(access).map((module: AdminModule) => ({
    href: withLocale(locale, MODULE_ROUTES[module]),
    label: t(`admin.modules.${module}`),
    icon: MODULE_ICONS[module],
  }));

  const legacyItems: ShellNavItem[] = [
    ...(isSuperAdmin(user.role)
      ? [{ href: withLocale(locale, "/admin/plantillas"), label: t("admin.templates"), icon: FileStack }]
      : []),
    { href: withLocale(locale, "/admin/organizaciones"), label: t("admin.orgs"), icon: Building2 },
    { href: withLocale(locale, "/admin/envios"), label: t("admin.calendar"), icon: CalendarDays },
    { href: withLocale(locale, "/admin/facturacion"), label: t("admin.billing"), icon: Receipt },
    { href: withLocale(locale, "/admin/auditoria"), label: t("admin.audit"), icon: ScrollText },
    { href: withLocale(locale, "/admin/analytics"), label: t("sidebar.analytics"), icon: BarChart3 },
  ];

  const items: ShellNavItem[] = staff
    ? [
        ...moduleItems,
        ...(isSuperAdmin(user.role) ? legacyItems : []),
        { href: withLocale(locale, "/dashboard"), label: t("admin.backToDashboard"), icon: LayoutDashboard },
      ]
    : [
        { href: withLocale(locale, "/admin"), label: t("admin.title"), icon: Gauge, exact: true },
        { href: withLocale(locale, "/dashboard"), label: t("admin.backToDashboard"), icon: LayoutDashboard },
        ...legacyItems,
      ];

  return (
    <AppShell
      items={items}
      brandHref={withLocale(locale, staff ? getDefaultAdminRoute(access) : "/admin")}
      brandLabel={
        <span className="leading-tight">
          <span className="block text-[13px] font-semibold text-primary">{t("admin.brand")}</span>
          <span className="block text-[10px] font-normal uppercase tracking-[0.14em] text-sidebar-foreground/55">
            {t("admin.brandAdmin")}
          </span>
        </span>
      }
      headerExtra={
        <>
          <Badge variant="outline" className="text-xs font-medium">
            {t(`admin.roles.${user.role}`, { defaultValue: user.role })}
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
