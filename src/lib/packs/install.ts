import type { SectorPack } from "./catalog";
import { writeStorage, readMigratedStorage } from "@/lib/storage-keys";

const INSTALLED_KEY = "menoska_installed_packs";

export type InstalledPackRecord = {
  packId: string;
  installedAt: string;
  bulletinDraft?: {
    name: string;
    subject: string;
    sections: SectorPack["bulletinSeed"]["sections"];
  };
  reportHints?: SectorPack["reportHints"];
};

function readInstalled(): InstalledPackRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = readMigratedStorage(INSTALLED_KEY, "abi_installed_packs");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as InstalledPackRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function listInstalledPacks(): InstalledPackRecord[] {
  return readInstalled();
}

/** Copies pack template into local seed store (bulletin draft + report hints). */
export function installPack(pack: SectorPack): InstalledPackRecord {
  const record: InstalledPackRecord = {
    packId: pack.id,
    installedAt: new Date().toISOString(),
    bulletinDraft: {
      name: pack.bulletinSeed.name,
      subject: pack.bulletinSeed.subject,
      sections: pack.bulletinSeed.sections,
    },
    reportHints: pack.reportHints,
  };
  const next = readInstalled().filter((r) => r.packId !== pack.id);
  next.push(record);
  if (typeof window !== "undefined") {
    writeStorage(INSTALLED_KEY, JSON.stringify(next));
  }
  return record;
}
