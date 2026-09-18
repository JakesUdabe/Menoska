export type DemoOrg = {
  id: string;
  name: string;
  domain: string;
  plan: "starter" | "business" | "enterprise";
  mrr: number;
  status: "active" | "trialing" | "past_due";
};

const KEY = "abi_orgs";

const SEED: DemoOrg[] = [
  { id: "org-abi", name: "ABI News", domain: "abinews.com", plan: "enterprise", mrr: 0, status: "active" },
  { id: "org-menoska", name: "Menoska Consulting", domain: "menoska.consulting", plan: "business", mrr: 890, status: "active" },
  { id: "org-astoha", name: "Astoha", domain: "astoha.com", plan: "starter", mrr: 290, status: "trialing" },
];

export function listOrgs(): DemoOrg[] {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      localStorage.setItem(KEY, JSON.stringify(SEED));
      return SEED;
    }
    return JSON.parse(raw) as DemoOrg[];
  } catch {
    return SEED;
  }
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
  localStorage.setItem(KEY, JSON.stringify(orgs));
  return created;
}
