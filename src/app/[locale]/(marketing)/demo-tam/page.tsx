"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useT } from "@/i18n/provider";
import { withLocale } from "@/lib/paths";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function DemoTamPage() {
  const t = useT();
  const { locale } = useLocale();
  const [population, setPopulation] = useState(50_000_000);
  const [penetration, setPenetration] = useState(2);
  const [arpu, setArpu] = useState(12_000);
  const [samShare, setSamShare] = useState(25);
  const [somShare, setSomShare] = useState(10);

  const { tam, sam, som } = useMemo(() => {
    const tamVal = population * (penetration / 100) * arpu;
    const samVal = tamVal * (samShare / 100);
    const somVal = samVal * (somShare / 100);
    return { tam: tamVal, sam: samVal, som: somVal };
  }, [population, penetration, arpu, samShare, somShare]);

  const fmt = (n: number) =>
    new Intl.NumberFormat(locale === "en" ? "en-GB" : "es-ES", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{t("demoTam.eyebrow")}</p>
      <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-ink">{t("demoTam.title")}</h1>
      <p className="mt-4 text-muted-foreground">{t("demoTam.lead")}</p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div>
            <Label htmlFor="pop">{t("demoTam.population")}</Label>
            <Input id="pop" type="number" value={population} onChange={(e) => setPopulation(Number(e.target.value) || 0)} />
          </div>
          <div>
            <Label htmlFor="pen">{t("demoTam.penetration")}</Label>
            <Input id="pen" type="number" step="0.1" value={penetration} onChange={(e) => setPenetration(Number(e.target.value) || 0)} />
          </div>
          <div>
            <Label htmlFor="arpu">{t("demoTam.arpu")}</Label>
            <Input id="arpu" type="number" value={arpu} onChange={(e) => setArpu(Number(e.target.value) || 0)} />
          </div>
          <div>
            <Label htmlFor="sam">{t("demoTam.samShare")}</Label>
            <Input id="sam" type="number" value={samShare} onChange={(e) => setSamShare(Number(e.target.value) || 0)} />
          </div>
          <div>
            <Label htmlFor="som">{t("demoTam.somShare")}</Label>
            <Input id="som" type="number" value={somShare} onChange={(e) => setSomShare(Number(e.target.value) || 0)} />
          </div>
        </div>
        <div className="flex flex-col justify-between rounded-xl border border-primary/20 bg-gradient-to-br from-primary/[0.07] to-transparent p-5">
          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">TAM</p>
              <p className="font-display text-2xl font-semibold text-ink">{fmt(tam)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">SAM</p>
              <p className="font-display text-2xl font-semibold text-ink">{fmt(sam)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">SOM</p>
              <p className="font-display text-2xl font-semibold text-primary">{fmt(som)}</p>
            </div>
          </div>
          <div className="mt-8 space-y-2">
            <p className="text-xs text-muted-foreground">{t("demoTam.ctaLead")}</p>
            <Button className="w-full" asChild>
              <Link href={withLocale(locale, "/registro")}>{t("demoTam.cta")}</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
