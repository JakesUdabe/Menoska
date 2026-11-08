import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "@/i18n/locales";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cookieLocale = request.headers
    .get("cookie")
    ?.split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${LOCALE_COOKIE}=`))
    ?.split("=")[1];
  const localeParam = url.searchParams.get("locale");
  const locale = isLocale(localeParam) ? localeParam : isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  const supabase = await createServerSupabase();
  if (!supabase) {
    return NextResponse.redirect(new URL(`/${locale}`, request.url));
  }

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL(`/${locale}/login?error=auth`, request.url));
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as "recovery" | "signup" | "email" | "invite" | "magiclink" | "email_change",
      token_hash: tokenHash,
    });
    if (error) {
      return NextResponse.redirect(new URL(`/${locale}/login?error=auth`, request.url));
    }
  }

  // Password recovery → set new password page
  if (type === "recovery") {
    return NextResponse.redirect(new URL(`/${locale}/nueva-contrasena`, request.url));
  }

  const next = url.searchParams.get("next");
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    if (next.includes("nueva-contrasena") || type === "recovery") {
      return NextResponse.redirect(new URL(`/${locale}/nueva-contrasena`, request.url));
    }
    return NextResponse.redirect(new URL(next, request.url));
  }

  // Email verification / signup confirm → dashboard
  return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
}
