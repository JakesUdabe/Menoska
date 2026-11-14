"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { contact } from "@/data/contact";
import { people } from "@/data/people";
import { serviceBySlug, serviceCatalog } from "@/data/services";
import { localeLabels, locales, type Locale } from "@/i18n/locales";
import { useLocale } from "./locale";

const codes: Record<Locale, string> = { es: "ES", en: "EN", eu: "EU", ca: "CA", gl: "GL" };

export function Shell({ children }: { children: React.ReactNode }) {
  const { copy, locale, setLocale } = useLocale();
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const menuId = useId();
  const langId = useId();
  const [stuck, setStuck] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const workspace = pathname.startsWith("/app") || pathname.startsWith("/acceso");

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobile(false);
    setServicesOpen(false);
    setLangOpen(false);
  }, [pathname]);

  useEffect(() => {
    let title = copy.metaTitle;
    if (pathname.startsWith("/contacto")) title = `${copy.contact.title} · Menoska Consulting`;
    else if (pathname.startsWith("/sobre-nosotros/")) {
      const person = people.find((item) => pathname.endsWith(item.slug));
      title = person ? `${person.name} · Menoska Consulting` : copy.metaTitle;
    } else if (pathname.startsWith("/sobre-nosotros")) title = `${copy.teamPage.title} · Menoska Consulting`;
    else if (pathname.startsWith("/servicios/")) {
      const service = serviceBySlug(pathname.split("/")[2] ?? "");
      if (service) title = `${copy.services[service.id].title} · Menoska Consulting`;
    } else if (pathname === "/aviso-legal") title = `${copy.legal.notice} · Menoska Consulting`;
    else if (pathname === "/politica-privacidad") title = `${copy.legal.privacy} · Menoska Consulting`;
    else if (pathname === "/politica-de-cookies") title = `${copy.legal.cookies} · Menoska Consulting`;
    document.title = title;
  }, [pathname, copy]);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!headerRef.current?.contains(event.target as Node)) {
        setServicesOpen(false);
        setLangOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setServicesOpen(false);
        setLangOpen(false);
        setMobile(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function chooseLanguage(next: Locale) {
    setLocale(next);
    setLangOpen(false);
    setMobile(false);
  }

  if (workspace) return <main id="contenido">{children}</main>;

  return (
    <>
      <a className="skip" href="#contenido">
        {copy.skip}
      </a>
      <header ref={headerRef} className={stuck ? "site-header is-stuck" : "site-header"}>
        <div className="wrap header-bar">
          <Link href="/" className="brand" aria-label="Menoska Consulting">
            <img src="/mark.svg" alt="" width={42} height={30} />
            <span>
              Menoska
              <small>Consulting</small>
            </span>
          </Link>

          <nav className={mobile ? "site-nav is-open" : "site-nav"} aria-label={copy.nav.services}>
            <div className="nav-drop">
              <button
                type="button"
                aria-expanded={servicesOpen}
                aria-controls={menuId}
                onClick={() => {
                  setServicesOpen((open) => !open);
                  setLangOpen(false);
                }}
              >
                {copy.nav.services}
              </button>
              <div id={menuId} className={servicesOpen ? "drop-panel is-open" : "drop-panel"} hidden={!servicesOpen}>
                {serviceCatalog.map((service) => (
                  <Link key={service.id} href={`/servicios/${service.slug}`}>
                    {copy.services[service.id].menu}
                  </Link>
                ))}
              </div>
            </div>
            <Link href="/sobre-nosotros" aria-current={pathname.startsWith("/sobre-nosotros") ? "page" : undefined}>
              {copy.nav.team}
            </Link>
            <Link href="/contacto" aria-current={pathname.startsWith("/contacto") ? "page" : undefined}>
              {copy.nav.contact}
            </Link>
          </nav>

          <div className="header-actions">
            <div className="nav-drop">
              <button
                type="button"
                className="lang-button"
                aria-label={copy.nav.language}
                aria-expanded={langOpen}
                aria-controls={langId}
                onClick={() => {
                  setLangOpen((open) => !open);
                  setServicesOpen(false);
                }}
              >
                {codes[locale]}
              </button>
              <div id={langId} className={langOpen ? "drop-panel lang-panel is-open" : "drop-panel lang-panel"} hidden={!langOpen} role="listbox" aria-label={copy.nav.language}>
                {locales.map((item) => (
                  <button key={item} type="button" role="option" aria-selected={item === locale} onClick={() => chooseLanguage(item)}>
                    {localeLabels[item]}
                  </button>
                ))}
              </div>
            </div>
            <Link className="login-button" href="/acceso">
              {copy.nav.login}
            </Link>
            <button
              type="button"
              className="burger"
              aria-expanded={mobile}
              aria-label={mobile ? copy.nav.closeMenu : copy.nav.openMenu}
              onClick={() => setMobile((open) => !open)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>
      <main id="contenido">{children}</main>
      <footer className="site-footer">
        <div className="wrap footer-grid">
          <div>
            <p className="footer-brand">Menoska Consulting</p>
            <p>{copy.footer.tagline}</p>
          </div>
          <div>
            <p className="footer-label">{copy.footer.services}</p>
            <ul>
              {serviceCatalog.map((service) => (
                <li key={service.id}>
                  <Link href={`/servicios/${service.slug}`}>{copy.services[service.id].menu}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="footer-label">{copy.footer.nav}</p>
            <ul>
              <li>
                <Link href="/">{copy.nav.home}</Link>
              </li>
              <li>
                <Link href="/sobre-nosotros">{copy.nav.team}</Link>
              </li>
              <li>
                <Link href="/contacto">{copy.nav.contact}</Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="footer-label">{copy.legal.group}</p>
            <ul>
              <li>
                <Link href="/aviso-legal" aria-current={pathname === "/aviso-legal" ? "page" : undefined}>
                  {copy.legal.notice}
                </Link>
              </li>
              <li>
                <Link href="/politica-privacidad" aria-current={pathname === "/politica-privacidad" ? "page" : undefined}>
                  {copy.legal.privacy}
                </Link>
              </li>
              <li>
                <Link href="/politica-de-cookies" aria-current={pathname === "/politica-de-cookies" ? "page" : undefined}>
                  {copy.legal.cookies}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="footer-label">{copy.footer.contact}</p>
            <ul>
              <li>
                {contact.place}, {contact.region}
              </li>
              <li>
                <a href={`mailto:${contact.email}`}>{contact.email}</a>
              </li>
              <li>
                <a href={`tel:${contact.phoneHref}`}>{contact.phoneDisplay}</a>
              </li>
            </ul>
          </div>
        </div>
        <div className="wrap footer-base">
          <p>
            © {new Date().getFullYear()} {copy.footer.rights}
          </p>
        </div>
      </footer>
    </>
  );
}
