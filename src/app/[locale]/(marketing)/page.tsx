import Link from "next/link";
import { isLocale, type Locale } from "@/i18n/locales";
import { createTranslator } from "@/i18n/server";
import { withLocale } from "@/lib/paths";
import { CATALOG_PLANS, formatEuros } from "@/lib/billing/catalog";
import { Button } from "@/components/ui/button";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "es") as Locale;
  const t = createTranslator(locale);
  const href = (path: string) => withLocale(locale, path);

  const modules = [
    { n: "01", title: t("home.tool1Title"), body: t("home.tool1Body"), tools: t("services.module1Tools") },
    { n: "02", title: t("home.tool2Title"), body: t("home.tool2Body"), tools: t("services.module2Tools") },
    { n: "03", title: t("home.tool3Title"), body: t("home.tool3Body"), tools: t("services.module3Tools") },
  ];

  const outcomes = [
    { n: "01", title: t("home.pain1Title"), body: t("home.pain1Body") },
    { n: "02", title: t("home.pain2Title"), body: t("home.pain2Body") },
    { n: "03", title: t("home.pain3Title"), body: t("home.pain3Body") },
  ];

  const results = [
    { n: "01", title: t("home.step1Title"), body: t("home.step1Body") },
    { n: "02", title: t("home.step2Title"), body: t("home.step2Body") },
    { n: "03", title: t("home.step3Title"), body: t("home.step3Body") },
  ];

  return (
    <div>
      <section className="relative min-h-[min(100svh,920px)] overflow-hidden mesh-hero">
        <div className="pointer-events-none absolute inset-0 landing-grid" aria-hidden />
        {/* Full-bleed brand mark as dominant visual plane */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-full max-w-none sm:w-[58%]" aria-hidden>
          <div className="absolute inset-0 bg-gradient-to-l from-ink/[0.07] via-transparent to-transparent" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/mark.svg"
            alt=""
            className="absolute -right-[8%] top-1/2 h-[min(78vh,640px)] w-auto -translate-y-1/2 opacity-[0.14] animate-drift sm:opacity-[0.22]"
          />
        </div>
        <div
          className="pointer-events-none absolute -right-24 top-16 h-[420px] w-[420px] rounded-full bg-primary/10 blur-3xl animate-drift sm:right-0"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-16 bottom-10 h-[280px] w-[280px] rounded-full bg-ink/10 blur-3xl animate-drift"
          style={{ animationDelay: "2.5s" }}
          aria-hidden
        />

        <div className="relative mx-auto flex max-w-6xl flex-col justify-end px-4 pb-20 pt-20 sm:pb-24 sm:pt-28 lg:min-h-[min(100svh,920px)] lg:justify-center lg:pb-28">
          <div className="animate-rise max-w-3xl">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/mark.svg" alt="" width={56} height={40} className="shrink-0" />
              <p className="font-display text-2xl tracking-tight sm:text-3xl lg:text-4xl">
                <span className="font-semibold text-primary">{t("common.brandShort")}</span>{" "}
                <span className="font-medium text-ink">{t("common.brandSuffix")}</span>
              </p>
            </div>
            <h1 className="mt-8 max-w-2xl font-display text-[2.35rem] font-semibold leading-[1.1] tracking-[-0.03em] text-ink sm:text-4xl lg:text-[3.15rem]">
              {t("home.title")}
              <span className="mt-1 block text-primary">{t("home.titleHighlight")}</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8 animate-fade-in">
              {t("home.subtitle")}
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button size="lg" className="glow-primary rounded-sm px-7" asChild>
                <Link href={href("/registro")}>{t("home.cta")}</Link>
              </Button>
              <Button size="lg" variant="outline" className="rounded-sm px-7" asChild>
                <a href="#modulos">{t("home.ctaSecondary")}</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section id="modulos" className="scroll-mt-20 border-t border-border bg-background">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:py-24">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">{t("home.toolsTitle")}</p>
          <h2 className="mt-3 max-w-3xl font-display text-3xl font-semibold tracking-[-0.03em] text-ink sm:text-4xl">{t("home.toolsLead")}</h2>
          <div className="mt-14 grid gap-0 border-y border-border md:grid-cols-3">
            {modules.map((item, i) => (
              <article
                key={item.n}
                className={`border-border py-8 md:p-10 ${i > 0 ? "border-t md:border-l md:border-t-0" : ""}`}
              >
                <p className="font-mono text-sm text-primary">{item.n}</p>
                <h3 className="mt-4 font-display text-xl font-semibold tracking-[-0.02em] text-ink sm:text-2xl">{item.title}</h3>
                <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground sm:text-[15px]">{item.body}</p>
                <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{item.tools}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-secondary/35">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:py-24">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">{t("home.modulesTitle")}</p>
          <h2 className="mt-3 max-w-3xl font-display text-3xl font-semibold tracking-[-0.03em] text-ink sm:text-4xl">{t("home.modulesLead")}</h2>
          <div className="mt-14 divide-y divide-border border-y border-border">
            {outcomes.map((item) => (
              <article key={item.n} className="grid gap-3 py-8 sm:grid-cols-[5.5rem_minmax(0,0.9fr)_minmax(0,1.2fr)] sm:gap-10 sm:py-10">
                <p className="font-mono text-sm text-primary">{item.n}</p>
                <h3 className="font-display text-xl font-semibold tracking-[-0.02em] text-ink sm:text-2xl">{item.title}</h3>
                <p className="text-sm leading-7 text-muted-foreground sm:text-[15px]">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:py-24">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">{t("home.howTitle")}</p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-[-0.03em] text-ink sm:text-4xl">{t("home.howLead")}</h2>
          <div className="mt-14 grid gap-0 md:grid-cols-3">
            {results.map((item, i) => (
              <article
                key={item.n}
                className={`border-border py-8 md:px-8 md:py-2 ${i === 0 ? "md:pl-0" : "md:border-l"} ${i === 2 ? "md:pr-0" : ""}`}
              >
                <p className="font-mono text-sm text-primary">{item.n}</p>
                <h3 className="mt-4 font-display text-xl font-semibold tracking-[-0.02em] text-ink">{item.title}</h3>
                <p className="mt-3 max-w-sm text-sm leading-7 text-muted-foreground">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-background">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:py-24">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">{t("pricing.eyebrow")}</p>
          <h2 className="mt-3 max-w-3xl font-display text-3xl font-semibold tracking-[-0.03em] text-ink sm:text-4xl">{t("pricing.title")}</h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">{t("pricing.vat")}</p>
          <div className="mt-10 grid gap-px border border-border bg-border md:grid-cols-3">
            {CATALOG_PLANS.map((offer) => (
              <article key={offer.plan} className="bg-background p-8">
                <h3 className="font-display text-xl font-semibold capitalize text-ink">{offer.plan}</h3>
                <p className="mt-4 font-display text-4xl font-semibold tracking-[-0.03em] text-ink">
                  {formatEuros(offer.monthlyCents, locale)}€
                  <span className="text-base font-normal text-muted-foreground">{t("pricing.month")}</span>
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {formatEuros(offer.yearlyCents, locale)}€{t("pricing.year")}
                </p>
              </article>
            ))}
          </div>
          <Button className="mt-8 rounded-sm" variant="outline" asChild>
            <Link href={href("/precios")}>{t("nav.pricing")}</Link>
          </Button>
        </div>
      </section>

      <section className="bg-ink text-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-16 sm:flex-row sm:items-end sm:justify-between sm:py-20">
          <div className="max-w-xl">
            <h2 className="font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">{t("home.ctaBandTitle")}</h2>
            <p className="mt-3 text-sm leading-7 text-background/70 sm:text-base">{t("home.ctaBandBody")}</p>
          </div>
          <Button size="lg" className="rounded-sm bg-primary px-7 text-primary-foreground hover:bg-primary/90" asChild>
            <Link href={href("/registro")}>{t("home.cta")}</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
