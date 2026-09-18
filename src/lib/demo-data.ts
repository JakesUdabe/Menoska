import type { CandidateItem } from "./and-filter";
import type { AppRole, PlanType } from "./rbac";

export type DemoProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: AppRole;
  locale: string;
  organizationId: string;
  organizationName: string;
  organizationDomain: string;
  plan: PlanType;
};

export const DEMO_LOGIN_ACCOUNTS = [
  { username: "1234", password: "1234", profileId: "user-client" },
  { username: "1234a", password: "1234a", profileId: "user-superadmin" },
  { username: "1234b", password: "1234b", profileId: "user-admin" },
] as const;

export const DEMO_PROFILES: DemoProfile[] = [
  {
    id: "user-superadmin",
    email: "superadmin@abinews.com",
    firstName: "Marina",
    lastName: "Soler",
    fullName: "Marina Soler",
    role: "superadmin",
    locale: "es",
    organizationId: "org-abi",
    organizationName: "ABI News",
    organizationDomain: "abinews.com",
    plan: "enterprise",
  },
  {
    id: "user-admin",
    email: "admin@menoska.consulting",
    firstName: "Unai",
    lastName: "Menoska",
    fullName: "Unai Menoska",
    role: "admin",
    locale: "es",
    organizationId: "org-menoska",
    organizationName: "Menoska Consulting",
    organizationDomain: "menoska.consulting",
    plan: "business",
  },
  {
    id: "user-client",
    email: "vt@menoska.consulting",
    firstName: "Laura",
    lastName: "Ibarra",
    fullName: "Laura Ibarra",
    role: "client",
    locale: "es",
    organizationId: "org-menoska",
    organizationName: "Menoska Consulting",
    organizationDomain: "menoska.consulting",
    plan: "business",
  },
];

export const DEMO_CANDIDATES: CandidateItem[] = [
  {
    id: "n1",
    title: "Bosch unveils flexible electronics printers for automotive interiors",
    body: "Bosch announced a production line of flexible electronics printers aimed at automotive dashboards in Europe.",
    url: "https://example.com/bosch-flexible-electronics",
    source: "news",
    publishedAt: "2026-09-14",
    company: "Bosch",
  },
  {
    id: "n2",
    title: "Bosch reports record quarterly revenue in power tools",
    body: "The industrial group beat expectations in its consumer power-tools division, with no mention of printed electronics.",
    url: "https://example.com/bosch-revenue",
    source: "news",
    publishedAt: "2026-09-13",
    company: "Bosch",
  },
  {
    id: "n3",
    title: "Printed electronics stretchable inks reach 40% elongation",
    body: "A materials start-up published results on stretchable conductive inks without naming automotive OEMs.",
    url: "https://example.com/inks",
    source: "news",
    publishedAt: "2026-09-12",
  },
  {
    id: "p1",
    title: "WO2026/441122 Flexible printed circuit for vehicle lighting",
    body: "Continental AG files a patent on flexible electronics printers applied to automotive lighting modules.",
    url: "https://www.lens.org/lens/patent/demo-441122",
    source: "patent",
    publishedAt: "2026-09-11",
    company: "Continental",
    ipc: "H05K1/02",
  },
  {
    id: "n4",
    title: "Continental opens a tyre recycling plant in Hungary",
    body: "The plant focuses on circular materials for tyres and does not discuss electronics or printing.",
    url: "https://example.com/continental-tyres",
    source: "news",
    publishedAt: "2026-09-10",
    company: "Continental",
  },
  {
    id: "p2",
    title: "EP4123456 OLED stack for flexible automotive displays",
    body: "LG Display describes an OLED stack manufactured with flexible electronics printers for automotive HUDs.",
    url: "https://www.lens.org/lens/patent/demo-ep4123456",
    source: "patent",
    publishedAt: "2026-09-09",
    company: "LG Display",
    ipc: "H10K59/10",
  },
];

export const DEMO_SEND_CALENDAR = [
  { id: "s1", org: "Menoska Consulting", bulletin: "Competencia automoción EU", when: "2026-09-22T07:00:00Z", status: "scheduled" },
  { id: "s2", org: "Astoha", bulletin: "Patentes baterías Si", when: "2026-09-23T06:30:00Z", status: "scheduled" },
  { id: "s3", org: "Menoska Consulting", bulletin: "Patentes emergentes printed electronics", when: "2026-09-29T07:00:00Z", status: "scheduled" },
];
