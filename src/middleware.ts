import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, LOCALES, negotiateLocale, type Locale } from "@/i18n/locales";
import { createMiddlewareSupabase } from "@/lib/supabase/middleware";
import { isSupabaseConfigured } from "@/lib/supabase/client";

const PUBLIC_FILE = /\.(.*)$/;

function localeFromHeader(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;
  const first = header.split(",")[0]?.trim();
  return negotiateLocale(first);
}

const RETIRED_TO_CASE = [
  "/dashboard/social-listening",
  "/dashboard/benchmarks",
  "/dashboard/packs",
  "/dashboard/integraciones",
  "/dashboard/design-partners",
  "/dashboard/partners",
  "/dashboard/modulos/estrategia",
  "/dashboard/modulos/mercado",
  "/dashboard/modulos/finanzas/modelos",
  "/dashboard/modulos/finanzas/estructura-capital",
  "/dashboard/modulos/finanzas/riesgo-credito",
  "/dashboard/modulos/finanzas/sensibilidad",
];

function retiredDestination(pathname: string, locale: Locale): string | null {
  const prefix = `/${locale}`;
  if (!pathname.startsWith(prefix)) return null;
  const path = pathname.slice(prefix.length) || "/";
  if (path === "/demo-tam" || path.startsWith("/demo-tam/")) return `${prefix}/servicios`;
  if (path === "/admin/arr" || path.startsWith("/admin/arr/")) return `${prefix}/admin`;
  if (RETIRED_TO_CASE.some((item) => path === item || path.startsWith(`${item}/`))) {
    return `${prefix}/dashboard/proyectos/project-thermal`;
  }
  return null;
}

function isProtectedAppPath(segments: string[]): boolean {
  // /:locale/dashboard... or /:locale/admin...
  const section = segments[1];
  return section === "dashboard" || section === "admin";
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname.startsWith("/api") || PUBLIC_FILE.test(pathname)) {
    return NextResponse.next();
  }

  const segments = pathname.split("/").filter(Boolean);
  const maybeLocale = segments[0];

  let response: NextResponse;
  let locale: Locale;

  if (isLocale(maybeLocale)) {
    locale = maybeLocale;
    const retired = retiredDestination(pathname, locale);
    if (retired) {
      const url = request.nextUrl.clone();
      url.pathname = retired;
      url.search = "";
      return NextResponse.redirect(url);
    }
    response = NextResponse.next({ request });
    response.cookies.set(LOCALE_COOKIE, maybeLocale, { path: "/", maxAge: 31536000 });
  } else {
    const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
    locale = isLocale(cookieLocale) ? cookieLocale : localeFromHeader(request.headers.get("accept-language"));
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    response = NextResponse.redirect(url);
    response.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 31536000 });
  }

  if (isSupabaseConfigured()) {
    const { supabase, response: refreshed } = createMiddlewareSupabase(request);
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Soft-guard: redirect unauthenticated users away from dashboard/admin
      if (!user && isLocale(maybeLocale) && isProtectedAppPath(segments)) {
        const login = request.nextUrl.clone();
        login.pathname = `/${locale}/login`;
        login.search = "";
        const redirect = NextResponse.redirect(login);
        refreshed.cookies.getAll().forEach((c) => {
          redirect.cookies.set(c.name, c.value);
        });
        redirect.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 31536000 });
        return redirect;
      }

      refreshed.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 31536000 });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (location) {
          const redirect = NextResponse.redirect(location);
          refreshed.cookies.getAll().forEach((c) => {
            redirect.cookies.set(c.name, c.value);
          });
          redirect.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 31536000 });
          return redirect;
        }
      }
      return refreshed;
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

export const localeList = LOCALES;
