import { LOCALES, type Locale } from "@/i18n/locales";

export function withLocale(locale: Locale, path: string) {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (clean === "/") return `/${locale}`;
  return `/${locale}${clean}`;
}

const localePrefix = new RegExp(`^/(${LOCALES.join("|")})(?=/|$)`);

export function pathWithoutLocale(pathname: string) {
  const stripped = pathname.replace(localePrefix, "");
  return stripped.length > 0 ? stripped : "/";
}

export function isNavActive(pathname: string, href: string, exact = false) {
  const current = pathWithoutLocale(pathname);
  const target = pathWithoutLocale(href);
  if (exact) return current === target;
  return current === target || current.startsWith(`${target}/`);
}
