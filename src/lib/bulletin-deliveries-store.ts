import { readMigratedStorage, writeStorage } from "./storage-keys";

export type BulletinDelivery = {
  id: string;
  bulletinId: string;
  bulletinName: string;
  org: string;
  recipients: string[];
  itemCount: number;
  when: string;
  status: "sent" | "demo";
  demo: boolean;
};

const KEY = "menoska_bulletin_deliveries";
const OLD_KEY = "abi_bulletin_deliveries";

function readAll(): BulletinDelivery[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = readMigratedStorage(KEY, OLD_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BulletinDelivery[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(items: BulletinDelivery[]) {
  writeStorage(KEY, JSON.stringify(items));
}

export function listBulletinDeliveries(): BulletinDelivery[] {
  return readAll().sort((a, b) => b.when.localeCompare(a.when));
}

export function recordBulletinDelivery(input: Omit<BulletinDelivery, "id">): BulletinDelivery {
  const next: BulletinDelivery = {
    ...input,
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `del-${Date.now()}`,
  };
  const all = readAll();
  all.unshift(next);
  writeAll(all);
  return next;
}
