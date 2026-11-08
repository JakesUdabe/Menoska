import { readMigratedStorage, writeStorage } from "@/lib/storage-keys";
import type { PlanType } from "@/lib/rbac";
import { maxAiGenerationsPerMonth, maxUsersPerOrg } from "@/lib/rbac";

const KEY = "menoska_quota_overrides";

export type QuotaOverride = {
  organizationId: string;
  /** Extra AI generations per month beyond plan cap */
  extraAi?: number;
  /** Extra seats beyond plan cap */
  extraSeats?: number;
  /** Extra bulletin sends allowance (informational / soft) */
  extraSends?: number;
  updatedAt: string;
};

type Store = Record<string, QuotaOverride>;

function readAll(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = readMigratedStorage(KEY, "abi_quota_overrides");
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Store;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(store: Store) {
  writeStorage(KEY, JSON.stringify(store));
}

export function getQuotaOverride(organizationId: string | null | undefined): QuotaOverride | null {
  if (!organizationId) return null;
  return readAll()[organizationId] ?? null;
}

export function incrementQuotaOverride(
  organizationId: string,
  kind: "seats" | "sends" | "ai",
  amount = 1,
): QuotaOverride {
  const all = readAll();
  const prev = all[organizationId] ?? {
    organizationId,
    extraAi: 0,
    extraSeats: 0,
    extraSends: 0,
    updatedAt: new Date().toISOString(),
  };
  const next: QuotaOverride = {
    ...prev,
    organizationId,
    updatedAt: new Date().toISOString(),
  };
  if (kind === "seats") next.extraSeats = (next.extraSeats ?? 0) + amount;
  else if (kind === "sends") next.extraSends = (next.extraSends ?? 0) + amount;
  else next.extraAi = (next.extraAi ?? 0) + (kind === "ai" ? amount : 10);
  all[organizationId] = next;
  writeAll(all);
  return next;
}

/** Demo purchase helper: seats → +3 seats; sends → +20 sends. */
export function purchaseAddonDemo(organizationId: string, kind: "seats" | "sends"): QuotaOverride {
  if (kind === "seats") return incrementQuotaOverride(organizationId, "seats", 3);
  return incrementQuotaOverride(organizationId, "sends", 20);
}

/** Effective AI cap including localStorage override (client). Enterprise stays unlimited. */
export function effectiveMaxAiGenerations(
  plan: PlanType | null | undefined,
  organizationId?: string | null,
): number | null {
  const base = maxAiGenerationsPerMonth(plan);
  if (base === null) return null;
  const extra = getQuotaOverride(organizationId)?.extraAi ?? 0;
  return base + extra;
}

/** Effective user/seat cap including override. */
export function effectiveMaxUsers(
  plan: PlanType | null | undefined,
  organizationId?: string | null,
): number | null {
  const base = maxUsersPerOrg(plan);
  if (base === null) return null;
  const extra = getQuotaOverride(organizationId)?.extraSeats ?? 0;
  return base + extra;
}
