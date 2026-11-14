"use client";

import Link from "next/link";
import type { PublicEmployee } from "@/lib/content";
import { useLocale } from "./locale";

export function CvView({ person }: { person: PublicEmployee }) {
  const { copy } = useLocale();
  const profile = person;

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
          {person.linkedin ? (
            <a className="btn" href={person.linkedin} target="_blank" rel="noreferrer">
              {copy.cv.linkedin}
            </a>
          ) : null}
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
