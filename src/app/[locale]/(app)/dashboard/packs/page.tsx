"use client";

import { useState } from "react";
import { Package, Check } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/i18n/provider";
import { SECTOR_PACKS } from "@/lib/packs/catalog";
import { installPack, listInstalledPacks } from "@/lib/packs/install";
import { Button } from "@/components/ui/button";

export default function PacksPage() {
  const t = useT();
  const [installed, setInstalled] = useState(() => new Set(listInstalledPacks().map((p) => p.packId)));

  function onInstall(id: string) {
    const pack = SECTOR_PACKS.find((p) => p.id === id);
    if (!pack) return;
    installPack(pack);
    setInstalled(new Set([...installed, id]));
    toast.success(t("packs.installed"));
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">{t("packs.eyebrow")}</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">{t("packs.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("packs.lead")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTOR_PACKS.map((pack) => {
          const done = installed.has(pack.id);
          return (
            <article key={pack.id} className="flex flex-col rounded-xl border border-border bg-card p-5">
              <Package className="size-5 text-primary" />
              <h2 className="mt-3 font-display text-lg font-semibold">{pack.name}</h2>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{pack.description}</p>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {pack.companies.slice(0, 3).join(" · ")}
              </p>
              <Button
                type="button"
                className="mt-4"
                variant={done ? "secondary" : "default"}
                disabled={done}
                onClick={() => onInstall(pack.id)}
              >
                {done ? (
                  <>
                    <Check className="size-4" />
                    {t("packs.installedLabel")}
                  </>
                ) : (
                  t("packs.install")
                )}
              </Button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
