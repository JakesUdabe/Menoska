"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabasePublicEnv } from "./env";

let client: ReturnType<typeof createBrowserClient> | null = null;

export function browserClient() {
  const env = supabasePublicEnv();
  if (!env) return null;
  if (!client) client = createBrowserClient(env.url, env.key);
  return client;
}
