"use client";

import { browserClient } from "@/lib/supabase/browser";

function go(path: string) {
  window.location.assign(path);
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = browserClient();
  if (!supabase) {
    go("/acceso?error=credenciales");
    return;
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  go(error ? "/acceso?error=credenciales" : "/app");
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
  go(error ? "/acceso/clave?error=clave" : "/app");
}
