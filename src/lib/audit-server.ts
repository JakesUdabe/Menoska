import { logAudit as logAuditLocal, type AuditEvent } from "@/lib/audit-store";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createServerSupabase } from "@/lib/supabase/server";

/** API-only audit write. Keeps `next/headers` out of the client bundle. */
export async function logAudit(input: Parameters<typeof logAuditLocal>[0]): Promise<AuditEvent> {
  const event = await logAuditLocal(input);
  if (!isSupabaseConfigured()) return event;

  const row = {
    id: event.id,
    organization_id: event.organizationId,
    user_id: event.userId,
    kind: event.kind,
    title: event.title,
    meta: event.meta,
    created_at: event.createdAt,
  };

  try {
    const supabase = await createServerSupabase();
    if (supabase) {
      const { error } = await supabase.from("mc_activity_events").insert(row);
      if (!error) return event;
      console.warn("mc_activity_events audit insert (user) skipped", error.message);
    }
    const admin = createAdminSupabase();
    if (admin) {
      const { error: adminErr } = await admin.from("mc_activity_events").insert(row);
      if (adminErr) console.warn("mc_activity_events audit insert (admin) skipped", adminErr.message);
    }
  } catch (err) {
    console.warn("logAudit server insert failed", err);
  }
  return event;
}
