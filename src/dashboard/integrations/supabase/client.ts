"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { browserClient } from "@/lib/supabase/browser";

function requireClient(): SupabaseClient {
  const client = browserClient();
  if (!client) throw new Error("Supabase no está configurado");
  return client as SupabaseClient;
}

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = requireClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
