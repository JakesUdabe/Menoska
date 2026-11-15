import { es } from "@/i18n/es";
import { people } from "@/data/people";
import type { Organization } from "@/data/organizations";
import { organizations } from "@/data/organizations";
import { createPublicClient } from "@/lib/supabase/public";

export type CvExperience = { role: string; org: string; when: string; text: string };
export type CvEducation = { title: string; org: string; when: string; text: string };
export type CvCredential = { title: string; org: string; when: string };

export type PublicEmployee = {
  id: string;
  slug: string;
  name: string;
  role: string;
  bio: string;
  image: string;
  linkedin: string;
  summary: string;
  experience: CvExperience[];
  education: CvEducation[];
  credentials: CvCredential[];
  visible: boolean;
};

export type SiteContent = {
  heroImage: string;
  aboutImage: string;
  stats: { value: number; prefix: string; suffix: string }[];
  organizations: Organization[];
  employees: PublicEmployee[];
};

const fallbackPeople: PublicEmployee[] = people.map((person) => {
  const copy = es.people[person.id];
  return {
    id: person.id,
    slug: person.slug,
    name: person.name,
    role: copy.role,
    bio: copy.bio,
    image: person.image,
    linkedin: person.linkedin,
    summary: copy.summary,
    experience: [...copy.experience],
    education: [...copy.education],
    credentials: [...copy.credentials],
    visible: true,
  };
});

const stockHero = "/images/hero.jpg";
const stockAbout = "/images/jakes.svg";

/** The cover keeps the mark unless the admin has uploaded a photo. */
export function landingHero(url: string | null | undefined) {
  if (!url || url === stockHero) return "/logo.svg";
  return url;
}

/** A custom cover photo wins. Otherwise the landing shows the team photo set in admin. */
export function landingAbout(about: string | null | undefined, person?: string | null) {
  if (about && about !== stockAbout) return about;
  if (person && person !== stockAbout) return person;
  return about || stockAbout;
}

const fallback: SiteContent = {
  heroImage: stockHero,
  aboutImage: stockAbout,
  stats: es.tailored.stats.map((stat) => ({ value: stat.value, prefix: stat.prefix, suffix: stat.suffix })),
  organizations,
  employees: fallbackPeople,
};

function asList<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export async function loadSite(): Promise<SiteContent> {
  const supabase = createPublicClient();
  if (!supabase) return fallback;
  const [settings, trajectory, employees] = await Promise.all([
    supabase.from("site_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("trajectory_items").select("name, href, logo_url, sort_order").order("sort_order"),
    supabase.from("employees").select("*").eq("visible", true).order("sort_order"),
  ]);
  if (settings.error || trajectory.error || employees.error || !settings.data) return fallback;

  const row = settings.data;
  const peopleRows = (employees.data ?? []).map((item) => ({
    id: item.id as string,
    slug: item.slug as string,
    name: item.name as string,
    role: item.role as string,
    bio: item.bio as string,
    image: (item.image_url as string) || "/images/jakes.svg",
    linkedin: (item.linkedin as string) || "",
    summary: item.summary as string,
    experience: asList<CvExperience>(item.experience),
    education: asList<CvEducation>(item.education),
    credentials: asList<CvCredential>(item.credentials),
    visible: true,
  }));

  return {
    heroImage: row.hero_image_url || fallback.heroImage,
    aboutImage: row.about_image_url || peopleRows[0]?.image || fallback.aboutImage,
    stats: [1, 2, 3, 4].map((index) => ({
      value: Number(row[`stat_${index}_value`]) || 0,
      prefix: String(row[`stat_${index}_prefix`] ?? ""),
      suffix: String(row[`stat_${index}_suffix`] ?? ""),
    })),
    organizations: (trajectory.data ?? []).map((item) => ({
      id: item.name as string,
      name: item.name as string,
      href: item.href as string,
      logo: (item.logo_url as string) || undefined,
    })),
    employees: peopleRows.length > 0 ? peopleRows : fallback.employees,
  };
}

export async function loadEmployee(slug: string) {
  const site = await loadSite();
  return site.employees.find((person) => person.slug === slug) ?? null;
}

export async function employeeParams() {
  const site = await loadSite();
  const slugs = new Set<string>(people.map((person) => person.slug));
  for (const person of site.employees) slugs.add(person.slug);
  return [...slugs].map((slug) => ({ slug }));
}
