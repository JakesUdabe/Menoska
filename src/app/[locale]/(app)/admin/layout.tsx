"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Building2, CalendarDays, Gauge, LayoutDashboard, LogOut, Radar, Receipt } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useLocale, useT } from "@/i18n/provider";
import { withLocale } from "@/lib/paths";
import { isOrgAdmin, isSuperAdmin } from "@/lib/rbac";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const { locale } = useLocale();
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && (!user || !isOrgAdmin(user.role))) {
      router.replace(withLocale(locale, user ? "/dashboard" : "/login"));
    }
  }, [loading, user, locale, router]);

  if (loading || !user || !isOrgAdmin(user.role)) {
    return <div className="p-8 text-sm text-muted-foreground">{t("common.loading")}</div>;
  }

  const items = [
    { href: withLocale(locale, "/admin"), label: t("admin.title"), icon: Gauge },
    { href: withLocale(locale, "/dashboard"), label: t("nav.dashboard"), icon: LayoutDashboard },
    { href: withLocale(locale, "/admin/organizaciones"), label: t("admin.orgs"), icon: Building2 },
    { href: withLocale(locale, "/admin/calendario"), label: t("admin.calendar"), icon: CalendarDays },
    { href: withLocale(locale, "/admin/facturacion"), label: t("admin.billing"), icon: Receipt },
    ...(isSuperAdmin(user.role)
      ? [{ href: withLocale(locale, "/admin/proyectos"), label: t("admin.projects"), icon: Radar }]
      : []),
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 border-r bg-card p-4 md:block">
        <p className="mb-6 font-display text-lg font-semibold tracking-tight">{t("nav.admin")}</p>
        <nav className="space-y-1">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${pathname === item.href ? "bg-accent text-signal" : "hover:bg-muted"}`}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <Button variant="ghost" className="mt-8 w-full justify-start" onClick={() => void signOut()}>
          <LogOut className="size-4" /> {t("nav.logout")}
        </Button>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {user.email} · {user.role} · {user.organizationName}
          </p>
          <LanguageSwitcher />
        </header>
        <nav className="flex gap-2 overflow-x-auto border-b px-4 py-2 md:hidden" aria-label="Admin mobile">
          {items.map((item) => (
            <Link
              key={`m-${item.href}`}
              href={item.href}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${pathname === item.href ? "bg-accent text-signal" : "bg-muted"}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <main id="main" className="flex-1 p-4 sm:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
