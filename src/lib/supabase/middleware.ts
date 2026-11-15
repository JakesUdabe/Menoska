import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { supabasePublicEnv } from "./env";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = supabasePublicEnv();
  const path = request.nextUrl.pathname;
  const bare = path.replace(/\/+$/, "") || "/";
  const redirectTo = (pathname: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };
  if (!env) {
    if (bare.startsWith("/app") || bare.startsWith("/admin")) return redirectTo("/acceso");
    return response;
  }
  const supabase = createServerClient(
    env.url,
    env.key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  if (!data.user && (bare.startsWith("/app") || bare.startsWith("/admin"))) {
    return redirectTo("/acceso");
  }
  if (data.user && (bare.startsWith("/app") || bare.startsWith("/admin") || bare === "/acceso")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();
    const role = profile?.role;
    if (role === "empleado" && (bare.startsWith("/app") || bare === "/acceso")) {
      return redirectTo("/admin");
    }
    if (bare.startsWith("/admin") && role !== "admin" && role !== "empleado") {
      return redirectTo("/app");
    }
    if (bare === "/acceso" && role !== "empleado") {
      return redirectTo("/app");
    }
  }
  return response;
}
