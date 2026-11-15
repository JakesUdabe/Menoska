"use client";

import { browserClient } from "@/lib/supabase/browser";
import { getProfile } from "@/lib/session";

function go(path: string) {
  window.location.assign(path);
}

export type AccessNotice = "invalid" | "unconfirmed" | "unavailable" | "sent" | "noaccess" | "expired";

function noticeFor(message: string): AccessNotice {
  const text = message.toLowerCase();
  if (text.includes("email not confirmed")) return "unconfirmed";
  if (text.includes("invalid api key") || text.includes("failed to fetch") || text.includes("network")) return "unavailable";
  return "invalid";
}

export async function signIn(email: string, password: string): Promise<AccessNotice | null> {
  const supabase = browserClient();
  if (!supabase) return "unavailable";
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) return noticeFor(error.message);
  const profile = await getProfile();
  if (!profile) {
    await supabase.auth.signOut();
    return "noaccess";
  }
  go("/app/");
  return null;
}

export async function sendPasswordReset(email: string): Promise<AccessNotice | null> {
  const supabase = browserClient();
  if (!supabase) return "unavailable";
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/auth/confirm/`,
  });
  if (error) return "unavailable";
  return "sent";
}

export async function setPassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8 || password !== confirm) {
    go("/acceso/clave?error=clave");
    return;
  }
  const supabase = browserClient();
  if (!supabase) {
    go("/acceso/clave?error=clave");
    return;
  }
  const { error } = await supabase.auth.updateUser({ password });
  go(error ? "/acceso/clave?error=clave" : "/app/");
}
