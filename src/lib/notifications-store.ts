import { readMigratedStorage, writeStorage } from "@/lib/storage-keys";

export type AppNotification = {
  id: string;
  organizationId: string | null;
  userId: string | null;
  kind: string;
  title: string;
  body?: string;
  createdAt: string;
};

const KEY = "menoska_notification_store";
const memory: AppNotification[] = [];

function readAll(): AppNotification[] {
  if (typeof window === "undefined") return [...memory];
  try {
    const raw = readMigratedStorage(KEY, "abi_notification_store");
    if (!raw) return [...memory];
    const parsed = JSON.parse(raw) as AppNotification[];
    return Array.isArray(parsed) ? parsed : [...memory];
  } catch {
    return [...memory];
  }
}

function writeAll(items: AppNotification[]) {
  const sliced = items.slice(0, 100);
  if (typeof window === "undefined") {
    memory.length = 0;
    memory.push(...sliced);
    return;
  }
  writeStorage(KEY, JSON.stringify(sliced));
}

export function pushNotification(input: {
  organizationId?: string | null;
  userId?: string | null;
  kind: string;
  title: string;
  body?: string;
}): AppNotification {
  const item: AppNotification = {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `ntf-${Date.now()}`,
    organizationId: input.organizationId ?? null,
    userId: input.userId ?? null,
    kind: input.kind,
    title: input.title,
    body: input.body,
    createdAt: new Date().toISOString(),
  };
  const all = readAll();
  all.unshift(item);
  writeAll(all);
  return item;
}

export function listNotifications(opts?: {
  organizationId?: string | null;
  userId?: string | null;
  limit?: number;
}): AppNotification[] {
  const limit = opts?.limit ?? 20;
  return readAll()
    .filter((n) => {
      if (opts?.organizationId && n.organizationId && n.organizationId !== opts.organizationId) return false;
      if (opts?.userId && n.userId && n.userId !== opts.userId) return false;
      return true;
    })
    .slice(0, limit);
}
