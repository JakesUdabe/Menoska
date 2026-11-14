"use client";

import Link from "next/link";
import { people } from "@/data/people";
import { useLocale } from "./locale";

export function TeamView() {
  const { copy } = useLocale();

  return (
    <section className="page-hero">
      <div className="wrap">
        <p className="kicker">{copy.teamPage.kicker}</p>
        <h1>{copy.teamPage.title}</h1>
        <h2 className="values-title">{copy.teamPage.valuesTitle}</h2>
        <div className="values">
          {copy.teamPage.values.map((value) => (
            <article key={value.title}>
              <h3>{value.title}</h3>
              <p>{value.text}</p>
            </article>
          ))}
        </div>
        <h2>{copy.teamPage.peopleTitle}</h2>
        <p className="lead">{copy.teamPage.lead}</p>
        <div className="people">
          {people.map((person) => {
            const profile = copy.people[person.id];
            return (
              <Link key={person.id} href={`/sobre-nosotros/${person.slug}`} className="person-card">
                <img src={person.image} alt={copy.teamPage.imageAlt} />
                <div>
                  <h3>{person.name}</h3>
                  <p className="role">{profile.role}</p>
                  <p>{profile.bio}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
