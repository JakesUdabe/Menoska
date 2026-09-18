import type { Locale } from "@/i18n/locales";

export function withLocale(locale: Locale, path: string) {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (clean === "/") return `/${locale}`;
  return `/${locale}${clean}`;
}
