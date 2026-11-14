export const people = [
  {
    id: "jakes",
    slug: "jakes-udabe",
    name: "Jakes Udabe Sánchez",
    image: "/images/jakes.svg",
    linkedin: "https://www.linkedin.com/in/jakes-udabe-a38609193/",
  },
] as const;

export type PersonId = (typeof people)[number]["id"];

export function personBySlug(slug: string) {
  return people.find((person) => person.slug === slug);
}
