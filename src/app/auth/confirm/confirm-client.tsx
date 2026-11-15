"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { browserClient } from "@/lib/supabase/browser";

export function ConfirmClient() {
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = browserClient();
      const code = params.get("code");
      const tokenHash = params.get("token_hash");
      const type = params.get("type") as EmailOtpType | null;
      if (!supabase) {
        router.replace("/acceso?error=enlace");
        return;
      }
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!cancelled) router.replace(error ? "/acceso?error=enlace" : "/acceso/clave");
        return;
      }
      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        const next = type === "invite" || type === "recovery" ? "/acceso/clave" : "/app";
        if (!cancelled) router.replace(error ? "/acceso?error=enlace" : next);
        return;
      }
      if (!cancelled) router.replace("/acceso");
    })();
    return () => {
      cancelled = true;
    };
  }, [params, router]);

  return <p className="wrap">Confirmando acceso…</p>;
}
