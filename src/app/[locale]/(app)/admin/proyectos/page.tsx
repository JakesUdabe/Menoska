"use client";

import { useT } from "@/i18n/provider";
import { MENOSKA_PROJECTS } from "@/lib/demo-data";
import { Badge } from "@/components/ui/badge";

export default function AdminProjectsPage() {
  const t = useT();
  return (
    <div>
      <h1 className="font-display text-3xl font-bold tracking-tight">{t("admin.projects")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("admin.projectsLead")}</p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {MENOSKA_PROJECTS.map((p) => (
          <article key={p.id} className="rounded-2xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{p.name}</h2>
              <Badge variant="secondary">TRL {p.trl}</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{p.short}</p>
            <p className="mt-3 text-xs uppercase text-signal">
              {p.status} · {p.category}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
