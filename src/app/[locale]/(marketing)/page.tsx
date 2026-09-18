import Link from "next/link";
import { isLocale, type Locale } from "@/i18n/locales";
import { createTranslator } from "@/i18n/server";
import { withLocale } from "@/lib/paths";
import { Button } from "@/components/ui/button";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "es") as Locale;
  const t = createTranslator(locale);
  const href = (path: string) => withLocale(locale, path);

  const stats = [
    { value: t("home.stat1Value"), label: t("home.stat1Label") },
    { value: t("home.stat2Value"), label: t("home.stat2Label") },
    { value: t("home.stat3Value"), label: t("home.stat3Label") },
    { value: t("home.stat4Value"), label: t("home.stat4Label") },
  ];

  const tools = [
    { n: "01", title: t("home.tool1Title"), body: t("home.tool1Body") },
    { n: "02", title: t("home.tool2Title"), body: t("home.tool2Body") },
    { n: "03", title: t("home.tool3Title"), body: t("home.tool3Body") },
    { n: "04", title: t("home.tool4Title"), body: t("home.tool4Body") },
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

  const panel = [
    { kind: t("home.tool1Title"), title: t("home.previewItem1Title"), status: t("home.previewItem1Status") },
    { kind: t("home.tool2Title"), title: t("home.previewItem2Title"), status: t("home.previewItem2Status") },
    { kind: t("home.tool3Title"), title: t("home.previewItem3Title"), status: t("home.previewItem3Status") },
    { kind: t("home.tool4Title"), title: t("home.previewItem4Title"), status: t("home.previewItem4Status") },
  ];

  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 landing-grid" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl items-end gap-14 px-4 pb-20 pt-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:pb-24 lg:pt-20">
          <div>
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              {t("home.badge")}
            </p>
            <h1 className="mt-5 max-w-xl font-display text-[2.75rem] font-semibold leading-[1.08] tracking-[-0.035em] sm:text-6xl lg:text-[4.1rem]">
              {t("home.title")}
              <span className="mt-1 block text-primary">{t("home.titleHighlight")}</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              {t("home.subtitle")}
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="rounded-sm px-7" asChild>
                <Link href={href("/registro")}>{t("home.cta")}</Link>
              </Button>
              <Button size="lg" variant="outline" className="rounded-sm px-7" asChild>
                <a href="#herramientas">{t("home.ctaSecondary")}</a>
              </Button>
            </div>
          </div>

          <aside className="landing-device overflow-hidden" aria-label={t("home.previewLabel")}>
            <div className="border-b border-white/10 px-6 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">{t("home.previewLabel")}</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-300/80">{t("home.previewLive")}</p>
              </div>
              <p className="mt-1 text-sm font-medium text-white/90">{t("home.previewMeta")}</p>
            </div>
            <ul className="divide-y divide-white/10 px-6">
              {panel.map((item) => (
                <li key={item.kind} className="flex items-start justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/45">{item.kind}</p>
                    <p className="mt-1.5 text-[13.5px] leading-5 text-white/92">{item.title}</p>
                  </div>
                  <p className="shrink-0 pt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/40">{item.status}</p>
                </li>
              ))}
            </ul>
            <div className="border-t border-white/10 px-6 py-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">{t("home.previewKept")}</p>
              <p className="mt-2 text-[13px] leading-5 text-white/80">{t("home.preview1Meta")}</p>
              <p className="mt-1 text-[13.5px] leading-5 text-white/92">{t("home.preview1Title")}</p>
            </div>
          </aside>
        </div>
      </section>

      <section className="border-y border-border">
        <div className="mx-auto grid max-w-6xl sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`px-4 py-10 sm:px-6 ${i > 0 ? "lg:border-l lg:border-border" : ""} ${i % 2 === 1 ? "sm:border-l sm:border-border" : ""}`}
            >
              <p className="font-mono text-3xl font-medium tracking-tight text-foreground">{s.value}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="herramientas" className="scroll-mt-20 mx-auto max-w-6xl px-4 py-20 sm:py-24">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">{t("home.toolsTitle")}</p>
        <h2 className="mt-3 max-w-3xl font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">{t("home.toolsLead")}</h2>
        <div className="mt-14 grid border-y border-border md:grid-cols-2">
          {tools.map((item, i) => (
            <article
              key={item.n}
              className={`border-border py-8 md:p-10 ${i > 0 ? "border-t" : ""} ${i === 1 ? "md:border-t-0 md:border-l" : ""} ${i === 2 ? "md:pl-0" : ""} ${i === 3 ? "md:border-l" : ""}`}
            >
              <p className="font-mono text-sm text-muted-foreground">{item.n}</p>
              <h3 className="mt-4 font-display text-xl font-semibold tracking-[-0.02em] sm:text-2xl">{item.title}</h3>
              <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground sm:text-[15px]">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-4 py-20 sm:py-24">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">{t("home.improveTitle")}</p>
          <h2 className="mt-3 max-w-3xl font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">{t("home.improveLead")}</h2>
          <div className="mt-14 divide-y divide-border border-y border-border">
            {outcomes.map((item) => (
              <article key={item.n} className="grid gap-3 py-8 sm:grid-cols-[5.5rem_minmax(0,0.9fr)_minmax(0,1.2fr)] sm:gap-10 sm:py-10">
                <p className="font-mono text-sm text-muted-foreground">{item.n}</p>
                <h3 className="font-display text-xl font-semibold tracking-[-0.02em] sm:text-2xl">{item.title}</h3>
                <p className="text-sm leading-7 text-muted-foreground sm:text-[15px]">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-secondary/40">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:py-24">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">{t("home.howTitle")}</p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">{t("home.howLead")}</h2>
          <div className="mt-14 grid gap-0 md:grid-cols-3">
            {results.map((item, i) => (
              <article
                key={item.n}
                className={`border-border py-8 md:px-8 md:py-2 ${i === 0 ? "md:pl-0" : "md:border-l"} ${i === 2 ? "md:pr-0" : ""}`}
              >
                <p className="font-mono text-sm text-muted-foreground">{item.n}</p>
                <h3 className="mt-4 font-display text-xl font-semibold tracking-[-0.02em]">{item.title}</h3>
                <p className="mt-3 max-w-sm text-sm leading-7 text-muted-foreground">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-ink text-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-16 sm:flex-row sm:items-end sm:justify-between sm:py-20">
          <div className="max-w-xl">
            <h2 className="font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">{t("home.ctaBandTitle")}</h2>
            <p className="mt-3 text-sm leading-7 text-background/70 sm:text-base">{t("home.ctaBandBody")}</p>
          </div>
          <Button size="lg" className="rounded-sm bg-background px-7 text-foreground hover:bg-background/90" asChild>
            <Link href={href("/registro")}>{t("home.cta")}</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
