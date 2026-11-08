import { readMigratedStorage, writeStorage } from "@/lib/storage-keys";

export type DesignPartnerNote = {
  id: string;
  partner: string;
  note: string;
  createdAt: string;
  createdBy?: string;
};

const KEY = "menoska_design_partner_notes";
const memory: DesignPartnerNote[] = [];

function read(): DesignPartnerNote[] {
  if (typeof window === "undefined") return [...memory];
  try {
    const raw = readMigratedStorage(KEY, "abi_design_partner_notes");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DesignPartnerNote[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items: DesignPartnerNote[]) {
  if (typeof window === "undefined") {
    memory.length = 0;
    memory.push(...items);
    return;
  }
  writeStorage(KEY, JSON.stringify(items.slice(0, 200)));
}

export function listDesignPartnerNotes(): DesignPartnerNote[] {
  return read().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function addDesignPartnerNote(input: Omit<DesignPartnerNote, "id" | "createdAt"> & { id?: string }): DesignPartnerNote {
  const note: DesignPartnerNote = {
    id: input.id ?? (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `dp-${Date.now()}`),
    partner: input.partner,
    note: input.note,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
  };
  const all = read();
  all.unshift(note);
  write(all);
  return note;
}

export function deleteDesignPartnerNote(id: string) {
  write(read().filter((n) => n.id !== id));
}
