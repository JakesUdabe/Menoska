export function supabasePublicEnv() {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!url || !key) return null;
  return { url, key };
}

export function normalizeSupabaseUrl(value: string | undefined) {
  let url = clean(value);
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) {
    if (/^[a-z0-9-]+\.supabase\.co\/?$/i.test(url)) url = `https://${url.replace(/\/$/, "")}`;
    else return null;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function clean(value: string | undefined) {
  return value?.trim().replace(/^['"]|['"]$/g, "") ?? "";
}
