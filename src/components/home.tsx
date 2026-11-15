"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Organization } from "@/data/organizations";
import { serviceCatalog } from "@/data/services";
import { landingAbout, landingHero } from "@/lib/content";
import { createPublicClient } from "@/lib/supabase/public";
import { OrgStrip } from "./org-strip";
import { StatRow } from "./stat-row";
import { useLocale } from "./locale";

export function Home({
  organizations,
  heroImage,
  aboutImage,
  stats,
}: {
  organizations: Organization[];
  heroImage: string;
  aboutImage: string;
  stats: { value: number; prefix: string; suffix: string }[];
}) {
  const { copy } = useLocale();
  const [heroSrc, setHeroSrc] = useState(() => landingHero(heroImage));
  const [aboutSrc, setAboutSrc] = useState(aboutImage);
  const [orgs, setOrgs] = useState(organizations);

  useEffect(() => {
    const supabase = createPublicClient();
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      const [settings, employees, trajectory] = await Promise.all([
        supabase.from("site_settings").select("hero_image_url, about_image_url").eq("id", 1).maybeSingle(),
        supabase.from("employees").select("image_url").eq("visible", true).order("sort_order").limit(1),
        supabase.from("trajectory_items").select("name, href, logo_url, sort_order").order("sort_order"),
      ]);
      if (cancelled) return;
      const person = employees.data?.[0]?.image_url as string | undefined;
      if (settings.data) {
        setHeroSrc(landingHero(settings.data.hero_image_url));
        setAboutSrc(landingAbout(settings.data.about_image_url, person));
      }
      if (trajectory.data && trajectory.data.length > 0) {
        setOrgs(
          trajectory.data.map((item) => ({
            id: item.name as string,
            name: item.name as string,
            href: item.href as string,
            logo: (item.logo_url as string) || undefined,
          })),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
          <img className={heroSrc.endsWith(".svg") ? "hero-logo" : undefined} src={heroSrc} alt={copy.hero.imageAlt} />
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
              <Link key={service.id} href={`/servicios/${service.slug}`} className="card">
                <p className="service-index">{String(index + 1).padStart(2, "0")}</p>
                <h3>{copy.services[service.id].title}</h3>
                <p>{copy.services[service.id].card}</p>
                <span className="card-more">
                  {copy.portfolio.more}
                  <span aria-hidden="true">→</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="tailored">
        <div className="wrap">
          <p className="kicker light">{copy.tailored.kicker}</p>
          <h2>{copy.tailored.title}</h2>
          <p className="lead">{copy.tailored.lead}</p>
          <StatRow
            stats={copy.tailored.stats.map((stat, index) => ({
              label: stat.label,
              value: stats[index]?.value ?? stat.value,
              prefix: stats[index]?.prefix ?? stat.prefix,
              suffix: stats[index]?.suffix ?? stat.suffix,
            }))}
          />
        </div>
      </section>

      <OrgStrip organizations={orgs} kicker={copy.orgs.kicker} />

      <section className="about-band">
        <div className="wrap about-grid">
          <img src={aboutSrc} alt={copy.teamPage.imageAlt} />
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
