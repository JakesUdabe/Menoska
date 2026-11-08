import type { CandidateItem } from "./and-filter";
import type { AppRole, PlanType } from "./rbac";
import { SHOWCASE_PATENTS } from "./showcase-case";

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
    email: "superadmin@menoska.com",
    firstName: "Marina",
    lastName: "Soler",
    fullName: "Marina Soler",
    role: "superadmin",
    locale: "es",
    organizationId: "org-abi",
    organizationName: "Menoska Consulting",
    organizationDomain: "menoska.com",
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

const SHOWCASE_PATENT_CANDIDATES: CandidateItem[] = SHOWCASE_PATENTS.map((patent) => ({
  id: patent.id,
  title: `${patent.id} ${patent.title}`,
  body: patent.body,
  url: patent.url,
  source: "patent" as const,
  publishedAt: patent.publishedAt,
  company: patent.assignee,
  ipc: patent.ipc,
}));

export const DEMO_CANDIDATES: CandidateItem[] = [
  ...SHOWCASE_PATENT_CANDIDATES,
  {
    id: "n-tesla-thermal",
    title: "Tesla public patents describe battery pack thermal runaway exhaust",
    body: "Granted Tesla documents cover how a battery pack enclosure vents gas and mitigates thermal runaway.",
    url: "https://patents.google.com/patent/US8268469B2/en",
    source: "news",
    publishedAt: "2012-09-18",
    company: "Tesla",
  },
  {
    id: "n-tesla-control",
    title: "Tesla battery pack temperature control is a granted patent",
    body: "US8082743B2 covers a control system that holds battery pack temperature inside an operating window.",
    url: "https://patents.google.com/patent/US8082743B2/en",
    source: "news",
    publishedAt: "2011-12-20",
    company: "Tesla",
  },
  {
    id: "n-tesla-deliveries",
    title: "Tesla reports quarterly vehicle deliveries",
    body: "Delivery totals for the quarter. No discussion of pack design.",
    url: "https://www.tesla.com/blog",
    source: "news",
    publishedAt: "2026-10-02",
    company: "Tesla",
  },
  {
    id: "n-generic-thermal",
    title: "Battery thermal management papers increase in academic journals",
    body: "Survey of cooling methods. No vehicle OEM is named.",
    url: "https://patents.google.com/?q=battery%20thermal%20management",
    source: "news",
    publishedAt: "2026-09-12",
  },
];

export const DEMO_SEND_CALENDAR = [
  {
    id: "s1",
    org: "Menoska Consulting",
    bulletin: "Vigilancia · térmica de baterías",
    when: "2026-11-02T07:00:00Z",
    status: "scheduled",
  },
];
