import { logAudit } from "./audit-store";
import { readMigratedStorage, writeStorage } from "./storage-keys";

export type DemoOrg = {
  id: string;
  name: string;
  domain: string;
  plan: "starter" | "business" | "enterprise";
  mrr: number;
  status: "active" | "trialing" | "past_due";
};

const KEY = "menoska_orgs";
const OLD_KEY = "abi_orgs";

const SEED: DemoOrg[] = [
  { id: "org-abi", name: "Menoska Consulting", domain: "menoska.com", plan: "enterprise", mrr: 0, status: "active" },
  { id: "org-menoska", name: "Menoska Consulting", domain: "menoska.consulting", plan: "business", mrr: 890, status: "active" },
  { id: "org-astoha", name: "Astoha", domain: "astoha.com", plan: "starter", mrr: 290, status: "trialing" },
];

function readAll(): DemoOrg[] {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = readMigratedStorage(KEY, OLD_KEY);
    if (!raw) {
      writeStorage(KEY, JSON.stringify(SEED));
      return SEED;
    }
    const parsed = JSON.parse(raw) as DemoOrg[];
    return Array.isArray(parsed) ? parsed : SEED;
  } catch {
    return SEED;
  }
}

export function listOrgs(): DemoOrg[] {
  return readAll();
}

export function upsertOrg(org: DemoOrg): DemoOrg {
  const orgs = readAll();
  const idx = orgs.findIndex((o) => o.id === org.id);
  const prev = idx >= 0 ? orgs[idx] : null;
  if (idx >= 0) orgs[idx] = org;
  else orgs.push(org);
  writeStorage(KEY, JSON.stringify(orgs));
  if (typeof window !== "undefined" && prev) {
    void logAudit({
      actorId: null,
      orgId: org.id,
      action: "org_update",
      meta: {
        orgId: org.id,
        name: org.name,
        plan: org.plan,
        domain: org.domain,
        previousPlan: prev.plan,
      },
    });
  }
  return org;
}

export function splitOrganization(sourceId: string, newName: string, newDomain: string): DemoOrg {
  const orgs = listOrgs();
  const created: DemoOrg = {
    id: crypto.randomUUID(),
    name: newName,
    domain: newDomain.replace(/^@/, "").toLowerCase(),
    plan: orgs.find((o) => o.id === sourceId)?.plan ?? "starter",
    mrr: 0,
    status: "trialing",
  };
  orgs.push(created);
  writeStorage(KEY, JSON.stringify(orgs));
  return created;
}
