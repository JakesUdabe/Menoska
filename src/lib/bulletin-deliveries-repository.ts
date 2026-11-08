import { isSupabaseConfigured, createClient } from "@/lib/supabase/client";
import {
  listBulletinDeliveries as listLocal,
  recordBulletinDelivery as recordLocal,
  type BulletinDelivery,
} from "@/lib/bulletin-deliveries-store";

export type { BulletinDelivery };

type OrgEmbed = { name: string } | { name: string }[] | null;
type BulletinEmbed = {
  name: string;
  organization_id: string;
  mc_organizations?: OrgEmbed;
};

type DeliveryRow = {
  id: string;
  bulletin_id: string;
  sent_at: string;
  item_count: number;
  recipients: string[] | null;
  demo: boolean;
  mc_bulletins?: BulletinEmbed | BulletinEmbed[] | null;
};

function asOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function orgName(org: OrgEmbed | undefined): string {
  const one = asOne(org ?? null);
  return one?.name ?? "";
}

function mapRow(row: DeliveryRow): BulletinDelivery {
  const bulletin = asOne(row.mc_bulletins);
  return {
    id: row.id,
    bulletinId: row.bulletin_id,
    bulletinName: bulletin?.name ?? "",
    org: orgName(bulletin?.mc_organizations),
    recipients: Array.isArray(row.recipients) ? row.recipients : [],
    itemCount: row.item_count ?? 0,
    when: row.sent_at,
    status: row.demo ? "demo" : "sent",
    demo: Boolean(row.demo),
  };
}

export async function listBulletinDeliveries(): Promise<BulletinDelivery[]> {
  if (!isSupabaseConfigured()) {
    return listLocal();
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("mc_bulletin_deliveries")
    .select(
      "id, bulletin_id, sent_at, item_count, recipients, demo, mc_bulletins(name, organization_id, mc_organizations(name))",
    )
    .order("sent_at", { ascending: false });
  if (error) {
    console.warn("mc_bulletin_deliveries list failed", error.message);
    return listLocal();
  }
  return (data as DeliveryRow[] | null)?.map(mapRow) ?? [];
}

export async function recordBulletinDelivery(
  input: Omit<BulletinDelivery, "id">,
): Promise<BulletinDelivery> {
  // Always mirror locally for demo/billing counters; remote insert happens in API send route.
  return recordLocal(input);
}
