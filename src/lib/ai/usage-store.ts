import { readMigratedStorage, writeStorage } from "@/lib/storage-keys";

const KEY = "menoska_ai_usage";
const MAX = 50;

/** Rough token estimate for client-side metering (mirrors server estimateTokens). */
export function estimateClientTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export type ClientAiUsageEvent = {
  id: string;
  userId: string;
  kind: string;
  at: string;
  tokensIn?: number;
  tokensOut?: number;
  meta?: Record<string, unknown>;
};

function readAll(): ClientAiUsageEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = readMigratedStorage(KEY, "abi_ai_usage");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ClientAiUsageEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(events: ClientAiUsageEvent[]) {
  writeStorage(KEY, JSON.stringify(events.slice(0, MAX)));
}

/** Append a client-side usage event after a successful AI generate / NL call (demo-friendly). */
export function appendClientAiUsage(input: {
  userId: string;
  kind: string;
  tokensIn?: number;
  tokensOut?: number;
  meta?: Record<string, unknown>;
}): ClientAiUsageEvent {
  const event: ClientAiUsageEvent = {
    id: `usage_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: input.userId,
    kind: input.kind,
    at: new Date().toISOString(),
    tokensIn: input.tokensIn,
    tokensOut: input.tokensOut,
    meta: input.meta,
  };
  const next = [event, ...readAll()].slice(0, MAX);
  writeAll(next);
  return event;
}

/** Last N usage events for a user (newest first). */
export function listRecentUsage(userId: string, limit = 10): ClientAiUsageEvent[] {
  return readAll()
    .filter((e) => e.userId === userId)
    .slice(0, limit);
}

function monthStartIso(d = new Date()): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

/** Count client-side AI usage events this calendar month (demo localStorage). */
export function countClientAiUsageThisMonth(userId: string): number {
  const since = monthStartIso();
  return readAll().filter((e) => e.userId === userId && e.at >= since).length;
}
