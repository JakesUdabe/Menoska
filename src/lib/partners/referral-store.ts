import { readMigratedStorage, writeStorage } from "@/lib/storage-keys";

export type ReferralCode = {
  id: string;
  code: string;
  label: string;
  organizationId: string;
  createdAt: string;
  clicks: number;
};

const KEY = "menoska_referral_codes";

function read(): ReferralCode[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = readMigratedStorage(KEY, "abi_referral_codes");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ReferralCode[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items: ReferralCode[]) {
  if (typeof window === "undefined") return;
  writeStorage(KEY, JSON.stringify(items));
}

export function listReferralCodes(organizationId: string): ReferralCode[] {
  return read().filter((c) => c.organizationId === organizationId);
}

export function createReferralCode(input: { organizationId: string; label: string }): ReferralCode {
  const code =
    input.label
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8) || "MENOSKA";
  const entry: ReferralCode = {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `ref-${Date.now()}`,
    code: `${code}-${Math.floor(Math.random() * 900 + 100)}`,
    label: input.label,
    organizationId: input.organizationId,
    createdAt: new Date().toISOString(),
    clicks: 0,
  };
  const all = read();
  all.push(entry);
  write(all);
  return entry;
}
