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
    { n: "01", title: t("home.tool1Title"), body: t("home.tool1Body") },
    { n: "02", title: t("home.tool2Title"), body: t("home.tool2Body") },
    { n: "03", title: t("home.tool3Title"), body: t("home.tool3Body") },
    { n: "04", title: t("home.tool4Title"), body: t("home.tool4Body") },
  ];

  return (
    <div>
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">{t("services.eyebrow")}</p>
        <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">{t("services.title")}</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">{t("services.lead")}</p>
        <div className="mt-14 grid border-y border-border md:grid-cols-2">
          {items.map((item, i) => (
            <article
              key={item.title}
              className={`border-border py-8 md:p-10 ${i > 0 ? "border-t" : ""} ${i === 1 ? "md:border-t-0 md:border-l" : ""} ${i === 2 ? "md:pl-0" : ""} ${i === 3 ? "md:border-l" : ""}`}
            >
              <p className="font-mono text-sm text-muted-foreground">{item.n}</p>
              <h2 className="mt-4 font-display text-xl font-semibold tracking-[-0.02em]">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.body}</p>
            </article>
          ))}
        </div>
        <aside className="mt-8 border border-border bg-ink px-7 py-10 text-background">
          <h2 className="font-display text-2xl font-semibold tracking-[-0.02em]">{t("services.andTitle")}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-background/70">{t("services.andBody")}</p>
          <Button size="lg" className="mt-8 rounded-sm bg-background px-7 text-foreground hover:bg-background/90" asChild>
            <Link href={withLocale(locale, "/registro")}>{t("home.cta")}</Link>
          </Button>
        </aside>
      </div>
    </div>
  );
}
