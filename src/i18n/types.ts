import type { PersonId } from "@/data/people";
import type { ServiceId } from "@/data/services";

export type ServiceCopy = {
  menu: string;
  title: string;
  card: string;
  lead: string;
  includes: [string, string, string, string, string, string];
  objective: string;
};

export type PersonCopy = {
  role: string;
  bio: string;
  summary: string;
  experience: [
    { role: string; org: string; when: string; text: string },
    { role: string; org: string; when: string; text: string },
    { role: string; org: string; when: string; text: string },
  ];
  education: [
    { title: string; org: string; when: string; text: string },
    { title: string; org: string; when: string; text: string },
    { title: string; org: string; when: string; text: string },
    { title: string; org: string; when: string; text: string },
    { title: string; org: string; when: string; text: string },
  ];
  credentials: [
    { title: string; org: string; when: string },
    { title: string; org: string; when: string },
    { title: string; org: string; when: string },
    { title: string; org: string; when: string },
    { title: string; org: string; when: string },
  ];
};

export type Messages = {
  metaTitle: string;
  metaDescription: string;
  skip: string;
  nav: {
    home: string;
    services: string;
    team: string;
    contact: string;
    login: string;
    loginNote: string;
    language: string;
    openMenu: string;
    closeMenu: string;
  };
  access: {
    kicker: string;
    title: string;
    email: string;
    password: string;
    submit: string;
    forgot: string;
    forgotTitle: string;
    forgotLead: string;
    send: string;
    sent: string;
    back: string;
    invalid: string;
    unconfirmed: string;
    expired: string;
    unavailable: string;
    noaccess: string;
  };
  hero: { kicker: string; title: string; lead: string; cta: string; imageAlt: string };
  intro: string;
  portfolio: { kicker: string; title: string; more: string };
  services: Record<ServiceId, ServiceCopy>;
  servicePage: { includes: string; objective: string; cta: string; imageAlt: string };
  tailored: {
    kicker: string;
    title: string;
    lead: string;
    stats: [
      { value: number; prefix: string; suffix: string; label: string },
      { value: number; prefix: string; suffix: string; label: string },
      { value: number; prefix: string; suffix: string; label: string },
      { value: number; prefix: string; suffix: string; label: string },
    ];
  };
  orgs: { kicker: string; title: string };
  about: { kicker: string; title: string; lead: string; cta: string };
  ctaBand: { title: string; lead: string; cta: string };
  teamPage: {
    kicker: string;
    title: string;
    peopleTitle: string;
    lead: string;
    openCv: string;
    imageAlt: string;
    valuesTitle: string;
    values: [
      { title: string; text: string },
      { title: string; text: string },
      { title: string; text: string },
      { title: string; text: string },
    ];
  };
  people: Record<PersonId, PersonCopy>;
  cv: {
    back: string;
    summary: string;
    experience: string;
    education: string;
    credentials: string;
    linkedin: string;
    imageAlt: string;
  };
  contact: {
    kicker: string;
    title: string;
    lead: string;
    place: string;
    email: string;
    phone: string;
    map: string;
    name: string;
    company: string;
    message: string;
    submit: string;
    pending: string;
  };
  footer: { nav: string; services: string; contact: string; tagline: string; rights: string };
  legal: {
    group: string;
    notice: string;
    privacy: string;
    cookies: string;
    updated: string;
    noticeSections: { heading: string; text: string }[];
    privacySections: { heading: string; text: string }[];
    cookiesSections: { heading: string; text: string }[];
  };
  notFound: { title: string; lead: string; back: string };
};
