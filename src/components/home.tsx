"use client";

import Link from "next/link";
import type { Organization } from "@/data/organizations";
import { serviceCatalog } from "@/data/services";
import { OrgStrip } from "./org-strip";
import { StatRow } from "./stat-row";
import { useLocale } from "./locale";

export function Home({ organizations }: { organizations: Organization[] }) {
  const { copy } = useLocale();

  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <p className="kicker">{copy.hero.kicker}</p>
            <h1>{copy.hero.title}</h1>
            <p className="lead">{copy.hero.lead}</p>
            <Link className="btn" href="/contacto">
              {copy.hero.cta}
            </Link>
          </div>
          <img src="/images/hero.jpg" alt={copy.hero.imageAlt} />
        </div>
      </section>

      <section className="intro-band">
        <div className="wrap">
          <p>{copy.intro}</p>
        </div>
      </section>

      <section className="section services-home">
        <div className="wrap">
          <p className="kicker">{copy.portfolio.kicker}</p>
          <div className="cards">
            {serviceCatalog.map((service, index) => (
              <article key={service.id} className="card">
                <p className="service-index">{String(index + 1).padStart(2, "0")}</p>
                <h3>
                  <Link href={`/servicios/${service.slug}`}>{copy.services[service.id].title}</Link>
                </h3>
                <p>{copy.services[service.id].card}</p>
                <Link className="card-more" href={`/servicios/${service.slug}`}>
                  {copy.portfolio.more}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="tailored">
        <div className="wrap">
          <p className="kicker light">{copy.tailored.kicker}</p>
          <h2>{copy.tailored.title}</h2>
          <p className="lead">{copy.tailored.lead}</p>
          <StatRow stats={copy.tailored.stats} />
        </div>
      </section>

      <OrgStrip organizations={organizations} kicker={copy.orgs.kicker} title={copy.orgs.title} />

      <section className="about-band">
        <div className="wrap about-grid">
          <img src="/images/jakes.svg" alt={copy.teamPage.imageAlt} />
          <div>
            <p className="kicker">{copy.about.kicker}</p>
            <h2>{copy.about.title}</h2>
            <p className="lead">{copy.about.lead}</p>
            <Link className="btn" href="/sobre-nosotros">
              {copy.about.cta}
            </Link>
          </div>
        </div>
      </section>

      <section className="cta-band">
        <div className="wrap">
          <h2>{copy.ctaBand.title}</h2>
          <p>{copy.ctaBand.lead}</p>
          <Link className="btn btn-light" href="/contacto">
            {copy.ctaBand.cta}
          </Link>
        </div>
      </section>
    </>
  );
}
