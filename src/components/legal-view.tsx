"use client";

import { useLocale } from "./locale";

type LegalKind = "notice" | "privacy" | "cookies";

export function LegalView({ kind }: { kind: LegalKind }) {
  const { copy } = useLocale();
  const title = copy.legal[kind];
  const sections =
    kind === "notice" ? copy.legal.noticeSections : kind === "privacy" ? copy.legal.privacySections : copy.legal.cookiesSections;

  return (
    <article className="legal-page">
      <div className="wrap narrow">
        <p className="kicker">{copy.legal.group}</p>
        <h1>{title}</h1>
        <p className="updated">{copy.legal.updated}</p>
        {sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            <p>{section.text}</p>
          </section>
        ))}
      </div>
    </article>
  );
}
