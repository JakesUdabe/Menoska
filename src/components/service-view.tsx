"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { serviceBySlug } from "@/data/services";
import { useLocale } from "./locale";

export function ServiceView() {
  const params = useParams<{ slug: string }>();
  const { copy } = useLocale();
  const service = serviceBySlug(params.slug);
  if (!service) {
    return (
      <section className="page-hero">
        <div className="wrap narrow">
          <h1>{copy.notFound.title}</h1>
          <p className="lead">{copy.notFound.lead}</p>
          <Link className="btn" href="/">
            {copy.notFound.back}
          </Link>
        </div>
      </section>
    );
  }
  const text = copy.services[service.id];

  return (
    <>
      <section className="page-hero">
        <div className="wrap narrow">
          <p className="crumbs">
            <Link href="/">{copy.nav.home}</Link>
            <span aria-hidden="true">/</span>
            <span>{copy.nav.services}</span>
          </p>
          <h1>{text.title}</h1>
          <p className="lead">{text.lead}</p>
        </div>
      </section>
      <section className="section">
        <div className="wrap service-layout">
          <img className="service-photo" src={service.image} alt={copy.servicePage.imageAlt} />
          <div className="service-copy">
            <div>
              <h2>{copy.servicePage.includes}</h2>
              <ul className="include-list">
                {text.includes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <aside className="objective">
              <p className="kicker">{copy.servicePage.objective}</p>
              <p>{text.objective}</p>
              <Link className="btn" href="/contacto">
                {copy.servicePage.cta}
              </Link>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
