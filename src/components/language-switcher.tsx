"use client";

import { usePathname, useRouter } from "next/navigation";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/i18n/locales";
import { useLocale, useT } from "@/i18n/provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { Globe } from "lucide-react";

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const auth = useAuth();

  const onSelect = (next: Locale) => {
    setLocale(next);
    if (auth.user) void auth.updateProfile({ locale: next });
    const parts = pathname.split("/").filter(Boolean);
    if (LOCALES.includes(parts[0] as Locale)) {
      parts[0] = next;
      router.push("/" + parts.join("/"));
    } else {
      router.push(`/${next}${pathname}`);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t("nav.language")} className="gap-2">
          <Globe className="size-4" />
          <span className="hidden sm:inline">{LOCALE_LABELS[locale]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
        {LOCALES.map((code) => (
          <DropdownMenuItem key={code} onClick={() => onSelect(code)} aria-current={code === locale}>
            {LOCALE_LABELS[code]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
