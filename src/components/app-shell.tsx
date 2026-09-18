"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useLocale, useT } from "@/i18n/provider";
import { isNavActive, withLocale } from "@/lib/paths";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SiteFooter } from "@/components/site-footer";
import { cn } from "@/lib/utils";

export type ShellNavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group?: string;
  exact?: boolean;
};

export function AppShell({
  children,
  items,
  brandLabel,
  brandHref,
  headerExtra,
  planSlot,
}: {
  children: ReactNode;
  items: ShellNavItem[];
  brandLabel: ReactNode;
  brandHref: string;
  headerExtra?: ReactNode;
  planSlot?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { signOut } = useAuth();
  const { locale } = useLocale();
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await signOut();
    router.replace(withLocale(locale, "/"));
  }

  const nav = (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {items.map((item, index) => {
        const showGroup = Boolean(item.group && item.group !== items[index - 1]?.group);
        const active = isNavActive(pathname, item.href, item.exact);
        return (
          <div key={item.href}>
            {showGroup ? (
              <div className="px-3 pb-2 pt-4 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                {item.group}
              </div>
            ) : null}
            <Link
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-primary/20"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <item.icon className="size-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {active ? <ChevronRight className="size-3" /> : null}
            </Link>
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-muted/20">
      {open ? (
        <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-300 lg:sticky lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-5">
          <Link href={brandHref} className="font-display font-semibold text-sidebar-foreground" onClick={() => setOpen(false)}>
            {brandLabel}
          </Link>
          <button type="button" className="text-sidebar-foreground lg:hidden" onClick={() => setOpen(false)} aria-label={t("common.cancel")}>
            <X className="size-5" />
          </button>
        </div>
        {nav}
        {planSlot ? <div className="mx-3 mb-3">{planSlot}</div> : null}
        <div className="border-t border-sidebar-border p-3">
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="size-4" />
            <span>{t("nav.logout")}</span>
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-lg lg:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label={t("common.openMenu")}>
            <Menu className="size-5" />
          </Button>
          <div className="flex-1" />
          <LanguageSwitcher />
          {headerExtra}
        </header>
        <main id="main" className="flex-1 p-4 lg:p-8">
          {children}
        </main>
        <SiteFooter compact />
      </div>
    </div>
  );
}

export function PlanBadge({ plan }: { plan: string }) {
  const t = useT();
  return (
    <div className="rounded-xl border border-sidebar-border/50 bg-sidebar-accent/50 p-4">
      <Badge className="text-[10px] uppercase" variant="secondary">
        {plan}
      </Badge>
      <p className="mt-2 text-[10px] text-sidebar-foreground/60">{t("sidebar.plan")}</p>
    </div>
  );
}
