import Link from "next/link";
import { isLocale, type Locale } from "@/i18n/locales";
import { createTranslator } from "@/i18n/server";
import { withLocale } from "@/lib/paths";
import { Button } from "@/components/ui/button";

export default async function ServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "es") as Locale;
  const t = createTranslator(locale);

  const items = [
    {
      n: "01",
      title: t("services.patentsTitle"),
      body: t("services.patentsBody"),
      tools: t("services.module1Tools"),
    },
    {
      n: "02",
      title: t("services.competitorsTitle"),
      body: t("services.competitorsBody"),
      tools: t("services.module2Tools"),
    },
    {
      n: "03",
      title: t("services.trendsTitle"),
      body: t("services.trendsBody"),
      tools: t("services.module3Tools"),
    },
  ];

  return (
    <div>
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">{t("services.eyebrow")}</p>
        <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold tracking-[-0.03em] text-ink sm:text-5xl">{t("services.title")}</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">{t("services.lead")}</p>
        <div className="mt-14 grid border-y border-border md:grid-cols-3">
          {items.map((item, i) => (
            <article
              key={item.title}
              className={`border-border py-8 md:p-10 ${i > 0 ? "border-t md:border-l md:border-t-0" : ""}`}
            >
              <p className="font-mono text-sm text-primary">{item.n}</p>
              <h2 className="mt-4 font-display text-xl font-semibold tracking-[-0.02em] text-ink">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.body}</p>
              <ul className="mt-5 space-y-1.5">
                {item.tools.split("·").map((tool) => (
                  <li key={tool} className="font-mono text-[12px] text-muted-foreground">
                    — {tool.trim()}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <aside className="mt-10 border border-border bg-ink px-7 py-10 text-background">
          <h2 className="font-display text-2xl font-semibold tracking-[-0.02em]">{t("common.tagline")}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-background/70">{t("home.ctaBandBody")}</p>
          <Button size="lg" className="mt-8 rounded-sm bg-primary px-7 text-primary-foreground hover:bg-primary/90" asChild>
            <Link href={withLocale(locale, "/registro")}>{t("home.cta")}</Link>
          </Button>
        </aside>
      </div>
    </div>
  );
}
