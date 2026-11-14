import { createClient } from "@supabase/supabase-js";
import { supabasePublicEnv } from "./env";

export function createPublicClient() {
  const env = supabasePublicEnv();
  if (!env) return null;
  return createClient(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
