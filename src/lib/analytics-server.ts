import { track as trackLocal, type AnalyticsProps } from "@/lib/analytics";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createServerSupabase } from "@/lib/supabase/server";

/** API-only analytics insert. Keeps `next/headers` out of the client bundle. */
export async function track(event: string, props: AnalyticsProps = {}): Promise<void> {
  await trackLocal(event, props);
  if (!isSupabaseConfigured()) return;

  const cleanProps: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value !== undefined) cleanProps[key] = value;
  }

  try {
    const supabase = await createServerSupabase();
    const client = supabase ?? createAdminSupabase();
    if (!client) return;
    const { error } = await client.from("mc_analytics_events").insert({
      event,
      props: cleanProps,
      user_id: typeof props.userId === "string" ? props.userId : null,
      organization_id: typeof props.organizationId === "string" ? props.organizationId : null,
    });
    if (error) console.warn("[analytics] insert failed", error.message);
  } catch (err) {
    console.warn("[analytics] error", err instanceof Error ? err.message : err);
  }
}
