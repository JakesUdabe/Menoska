"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FileText, LogOut, Receipt, Shield, UserRound } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useLocale, useT } from "@/i18n/provider";
import { withLocale } from "@/lib/paths";
import { LanguageSwitcher } from "@/components/language-switcher";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { isOrgAdmin } from "@/lib/rbac";
import { useEffect } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const { locale } = useLocale();
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace(withLocale(locale, "/login"));
  }, [loading, user, locale, router]);

  if (loading || !user) {
    return <div className="p-8 text-sm text-muted-foreground">{t("common.loading")}</div>;
  }

  const items = [
    { href: withLocale(locale, "/dashboard"), label: t("dashboard.title"), icon: FileText },
    { href: withLocale(locale, "/dashboard/perfil"), label: t("dashboard.profile"), icon: UserRound },
    { href: withLocale(locale, "/dashboard/facturacion"), label: t("dashboard.billing"), icon: Receipt },
    ...(isOrgAdmin(user.role)
      ? [{ href: withLocale(locale, "/admin"), label: t("admin.panel"), icon: Shield }]
      : []),
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 border-r bg-card p-4 md:block">
        <Link href={withLocale(locale, "/")} className="mb-6 flex items-center gap-2.5 font-display font-semibold tracking-tight">
          <BrandMark /> {t("common.brand")}
        </Link>
        <nav className="space-y-1" aria-label="Dashboard">
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
          <div>
            <p className="text-sm font-medium">{user.fullName}</p>
            <p className="text-xs text-muted-foreground">
              {user.organizationName} · {user.role} · {user.plan}
            </p>
          </div>
          <LanguageSwitcher />
        </header>
        <nav className="flex gap-2 overflow-x-auto border-b px-4 py-2 md:hidden" aria-label="Dashboard mobile">
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
