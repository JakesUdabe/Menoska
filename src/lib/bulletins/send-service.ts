import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getBulletin, type StoredBulletin } from "@/lib/bulletins-store";
import { buildBulletinHtml, pickBulletinItems } from "@/lib/bulletins/html";
import { sendBulletinEmail, getResend } from "@/lib/email/resend";

const BULLETIN_SELECT =
  "*, mc_bulletin_sections(title, companies, technologies, sort_order), mc_bulletin_recipients(email, companies, technologies)";

type DbBulletin = {
  id: string;
  created_by: string;
  organization_id: string;
  name: string;
  subject: string | null;
  language: string;
  frequency: StoredBulletin["frequency"];
  send_day: number | null;
  send_hour: number;
  timezone: string;
  nl_query: string | null;
  mode: string;
  status: StoredBulletin["status"];
  max_items: number;
  created_at: string;
  updated_at: string;
  mc_bulletin_sections?: Array<{
    title: string;
    companies: string[] | null;
    technologies: string[] | null;
    sort_order: number;
  }>;
  mc_bulletin_recipients?: Array<{
    email: string;
    companies: string[] | null;
    technologies: string[] | null;
  }>;
};

export function mapDbBulletin(data: DbBulletin): StoredBulletin {
  const sections =
    Array.isArray(data.mc_bulletin_sections) && data.mc_bulletin_sections.length > 0
      ? [...data.mc_bulletin_sections]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((s) => ({
            title: s.title,
            companies: s.companies ?? [],
            technologies: s.technologies ?? [],
          }))
      : [{ title: "Sección 1", companies: [] as string[], technologies: [] as string[] }];
  const recipients = (data.mc_bulletin_recipients ?? []).map((r) => ({
    email: r.email,
    companies: r.companies ?? [],
    technologies: r.technologies ?? [],
  }));
  return {
    id: data.id,
    createdBy: data.created_by,
    organizationId: data.organization_id,
    name: data.name,
    subject: data.subject ?? data.name,
    language: data.language ?? "es",
    frequency: data.frequency,
    sendDay: data.send_day,
    sendHour: data.send_hour,
    timezone: data.timezone,
    recipients,
    mode: data.mode === "advanced" ? "advanced" : "common",
    nlQuery: data.nl_query ?? "",
    sections,
    maxItems: data.max_items ?? 10,
    status: data.status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function loadBulletinById(bulletinId: string): Promise<StoredBulletin | undefined> {
  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabase();
    const client = supabase ?? createAdminSupabase();
    if (client) {
      const { data } = await client.from("mc_bulletins").select(BULLETIN_SELECT).eq("id", bulletinId).maybeSingle();
      if (data) return mapDbBulletin(data as DbBulletin);
    }
  }
  return getBulletin(bulletinId);
}

export type SendBulletinResult =
  | {
      ok: true;
      demo: boolean;
      id?: string | null;
      itemCount: number;
      delivery: {
        bulletinId: string;
        bulletinName: string;
        org: string;
        recipients: string[];
        itemCount: number;
        when: string;
        status: "sent" | "demo";
        demo: boolean;
        html?: string;
      };
    }
  | { ok: false; error: string; status?: number };

export async function sendBulletinById(input: {
  bulletinId: string;
  /** Only trusted in demo mode — production always loads from DB. */
  bulletinOverride?: StoredBulletin;
  orgName?: string;
  /** When set, require ownership / org match for non-demo. */
  userId?: string;
}): Promise<SendBulletinResult> {
  let bulletin: StoredBulletin | undefined;

  if (!isSupabaseConfigured() && input.bulletinOverride) {
    bulletin = input.bulletinOverride;
  } else {
    bulletin = await loadBulletinById(input.bulletinId);
    if (!bulletin && !isSupabaseConfigured() && input.bulletinOverride) {
      bulletin = input.bulletinOverride;
    }
  }

  if (!bulletin) {
    return { ok: false, error: "bulletin_required", status: 400 };
  }

  if (input.userId && isSupabaseConfigured()) {
    const owned = bulletin.createdBy === input.userId;
    if (!owned) {
      const supabase = await createServerSupabase();
      if (supabase) {
        const { data: profile } = await supabase
          .from("mc_profiles")
          .select("organization_id, role")
          .eq("id", input.userId)
          .maybeSingle();
        const sameOrg = profile?.organization_id && profile.organization_id === bulletin.organizationId;
        const admin = profile?.role === "admin" || profile?.role === "superadmin";
        if (!sameOrg || !admin) {
          if (!sameOrg && bulletin.createdBy !== input.userId) {
            return { ok: false, error: "forbidden", status: 403 };
          }
        }
      }
    }
  }

  const items = pickBulletinItems(bulletin);
  const html = buildBulletinHtml(bulletin, items, { orgName: input.orgName });
  const to = bulletin.recipients.map((r) => r.email).filter(Boolean);
  const when = new Date().toISOString();
  const hasResend = Boolean(getResend());

  if (!hasResend || !isSupabaseConfigured()) {
    return {
      ok: true,
      demo: true,
      itemCount: items.length,
      delivery: {
        bulletinId: bulletin.id,
        bulletinName: bulletin.name,
        org: input.orgName ?? "",
        recipients: to,
        itemCount: items.length,
        when,
        status: "demo",
        demo: true,
        html,
      },
    };
  }

  // Retry Resend up to 2 times with exponential backoff (Hito 2)
  let sent: Awaited<ReturnType<typeof sendBulletinEmail>> = { ok: false, error: "send_failed" };
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    sent = await sendBulletinEmail({
      to,
      subject: bulletin.subject || bulletin.name,
      html,
    });
    if (sent.ok) break;
    if (attempt < maxAttempts) {
      const delayMs = 400 * 2 ** (attempt - 1);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  const supabase = await createServerSupabase();

  if (!sent.ok) {
    const failPayload = {
      bulletin_id: bulletin.id,
      sent_at: when,
      html,
      item_count: items.length,
      recipients: to,
      demo: false,
      status: "failed",
      error_message: sent.error,
    };
    if (supabase) {
      const { error } = await supabase.from("mc_bulletin_deliveries").insert(failPayload);
      if (error) {
        console.warn("mc_bulletin_deliveries failure insert skipped", error.message);
        const admin = createAdminSupabase();
        if (admin) {
          const { error: adminErr } = await admin.from("mc_bulletin_deliveries").insert(failPayload);
          if (adminErr) console.warn("mc_bulletin_deliveries failure insert (admin) skipped", adminErr.message);
        }
      }
    }
    return { ok: false, error: sent.error, status: 502 };
  }

  const deliveryPayload = {
    bulletin_id: bulletin.id,
    sent_at: when,
    html,
    item_count: items.length,
    recipients: to,
    demo: false,
    status: "sent",
  };
  let deliveryId = sent.id ?? null;
  if (supabase) {
    const { data: deliveryRow, error } = await supabase
      .from("mc_bulletin_deliveries")
      .insert(deliveryPayload)
      .select("id")
      .maybeSingle();
    if (error) {
      console.warn("mc_bulletin_deliveries insert (user) skipped", error.message);
      const admin = createAdminSupabase();
      if (admin) {
        const { data: adminRow, error: adminErr } = await admin
          .from("mc_bulletin_deliveries")
          .insert(deliveryPayload)
          .select("id")
          .maybeSingle();
        if (adminErr) console.warn("mc_bulletin_deliveries insert (admin) skipped", adminErr.message);
        else if (adminRow?.id) deliveryId = adminRow.id;
      }
    } else if (deliveryRow?.id) {
      deliveryId = deliveryRow.id;
    }
  }

  return {
    ok: true,
    demo: false,
    id: deliveryId,
    itemCount: items.length,
    delivery: {
      bulletinId: bulletin.id,
      bulletinName: bulletin.name,
      org: input.orgName ?? "",
      recipients: to,
      itemCount: items.length,
      when,
      status: "sent",
      demo: false,
    },
  };
}

/** Whether a bulletin should send in the current hour for its timezone. */
export function isBulletinDueNow(bulletin: Pick<StoredBulletin, "frequency" | "sendDay" | "sendHour" | "timezone">, now = new Date()): boolean {
  try {
    const tz = bulletin.timezone || "UTC";
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      day: "numeric",
      hour: "numeric",
      hour12: false,
    }).formatToParts(now);

    const weekdayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    const weekday = weekdayMap[parts.find((p) => p.type === "weekday")?.value ?? ""] ?? now.getUTCDay();
    const dayOfMonth = Number(parts.find((p) => p.type === "day")?.value ?? now.getUTCDate());
    let hour = Number(parts.find((p) => p.type === "hour")?.value ?? now.getUTCHours());
    if (hour === 24) hour = 0;

    if (hour !== bulletin.sendHour) return false;

    switch (bulletin.frequency) {
      case "daily":
        return true;
      case "weekly":
        return bulletin.sendDay == null || bulletin.sendDay === weekday;
      case "biweekly": {
        if (bulletin.sendDay != null && bulletin.sendDay !== weekday) return false;
        const week = Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000));
        return week % 2 === 0;
      }
      case "monthly":
        return bulletin.sendDay == null || bulletin.sendDay === dayOfMonth;
      default:
        return false;
    }
  } catch {
    return false;
  }
}

export async function listActiveBulletinsForCron(): Promise<StoredBulletin[]> {
  if (!isSupabaseConfigured()) return [];
  const admin = createAdminSupabase();
  if (!admin) return [];
  const { data, error } = await admin.from("mc_bulletins").select(BULLETIN_SELECT).eq("status", "active");
  if (error || !data) {
    if (error) console.warn("cron bulletins list failed", error.message);
    return [];
  }
  return (data as DbBulletin[]).map(mapDbBulletin);
}
