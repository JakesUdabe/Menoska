"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { personBySlug } from "@/data/people";
import { useLocale } from "./locale";

export function CvView() {
  const params = useParams<{ slug: string }>();
  const { copy } = useLocale();
  const person = personBySlug(params.slug);
  if (!person) {
    return (
      <section className="page-hero">
        <div className="wrap narrow">
          <h1>{copy.notFound.title}</h1>
          <p className="lead">{copy.notFound.lead}</p>
          <Link className="btn" href="/sobre-nosotros">
            {copy.cv.back}
          </Link>
        </div>
      </section>
    );
  }
  const profile = copy.people[person.id];

  return (
    <article className="cv">
      <div className="wrap cv-grid">
        <header>
          <Link className="card-more" href="/sobre-nosotros">
            {copy.cv.back}
          </Link>
          <img src={person.image} alt={copy.cv.imageAlt} />
          <h1>{person.name}</h1>
          <p className="role">{profile.role}</p>
          <a className="btn" href={person.linkedin} target="_blank" rel="noreferrer">
            {copy.cv.linkedin}
          </a>
        </header>
        <div>
          <section>
            <h2>{copy.cv.summary}</h2>
            <p>{profile.summary}</p>
          </section>
          <section>
            <h2>{copy.cv.experience}</h2>
            {profile.experience.map((item) => (
              <article key={item.org}>
                <h3>{item.role}</h3>
                <p className="meta">
                  {item.org} · {item.when}
                </p>
                <p>{item.text}</p>
              </article>
            ))}
          </section>
          <section>
            <h2>{copy.cv.education}</h2>
            {profile.education.map((item) => (
              <article key={item.title}>
                <h3>{item.title}</h3>
                <p className="meta">
                  {item.org} · {item.when}
                </p>
                <p>{item.text}</p>
              </article>
            ))}
          </section>
          <section>
            <h2>{copy.cv.credentials}</h2>
            <ul className="credential-list">
              {profile.credentials.map((item) => (
                <li key={item.title}>
                  <strong>{item.title}</strong>
                  <span>
                    {item.org} · {item.when}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </article>
  );
}
