"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { useT, useLocale } from "@/i18n/provider";
import { withLocale } from "@/lib/paths";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";

export function SiteHeader() {
  const t = useT();
  const { locale } = useLocale();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const href = (path: string) => withLocale(locale, path);

  const links = [
    { href: href("/"), label: t("nav.home") },
    { href: href("/servicios"), label: t("nav.services") },
    { href: href("/precios"), label: t("nav.pricing") },
    { href: href("/contacto"), label: t("nav.contact") },
  ];

  return (
    <header className="sticky top-0 z-[100] isolate border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href={href("/")} className="text-[15px] font-semibold tracking-tight">
          {t("common.brand")}
        </Link>
        <nav className="hidden items-center gap-6 md:flex" aria-label="Primary">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          {user ? (
            <Button size="sm" asChild>
              <Link href={href(user.role === "client" ? "/dashboard" : user.role === "admin" ? "/dashboard" : "/admin")}>{t("nav.dashboard")}</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
                <Link href={href("/login")}>{t("nav.login")}</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href={href("/registro")}>{t("nav.register")}</Link>
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen((v) => !v)} aria-label={t("common.openMenu")}>
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </div>
      {open ? (
        <nav className="border-t px-4 py-3 md:hidden" aria-label="Mobile">
          <div className="flex flex-col gap-3">
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-sm">
                {l.label}
              </Link>
            ))}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
