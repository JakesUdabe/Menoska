import type { AppRole } from "@/lib/rbac";
import { writeStorage } from "@/lib/storage-keys";

export type OrgInvite = {
  id: string;
  organizationId: string;
  organizationName?: string;
  email: string;
  role: AppRole;
  invitedBy: string | null;
  token: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
};

const KEY = "menoska_invites";

/** Process-local demo store for API routes (no localStorage on server). */
const memoryInvites: OrgInvite[] = [];

export function randomInviteToken(): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return `tok-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readBrowser(): OrgInvite[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OrgInvite[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeBrowser(items: OrgInvite[]) {
  if (typeof window === "undefined") return;
  writeStorage(KEY, JSON.stringify(items));
}

export function listDemoInvites(): OrgInvite[] {
  if (typeof window !== "undefined") {
    const browser = readBrowser();
    if (browser.length) return browser;
  }
  return [...memoryInvites];
}

export function upsertDemoInvite(invite: OrgInvite): OrgInvite {
  const idx = memoryInvites.findIndex((i) => i.id === invite.id || i.token === invite.token);
  if (idx >= 0) memoryInvites[idx] = invite;
  else memoryInvites.unshift(invite);

  if (typeof window !== "undefined") {
    const all = readBrowser();
    const bIdx = all.findIndex((i) => i.id === invite.id || i.token === invite.token);
    if (bIdx >= 0) all[bIdx] = invite;
    else all.unshift(invite);
    writeBrowser(all);
  }
  return invite;
}

export function findDemoInviteByToken(token: string): OrgInvite | undefined {
  const fromMem = memoryInvites.find((i) => i.token === token);
  if (fromMem) return fromMem;
  return readBrowser().find((i) => i.token === token);
}

export function listDemoPendingForOrg(organizationId: string): OrgInvite[] {
  const now = Date.now();
  return listDemoInvites().filter(
    (i) => i.organizationId === organizationId && !i.acceptedAt && new Date(i.expiresAt).getTime() > now,
  );
}
