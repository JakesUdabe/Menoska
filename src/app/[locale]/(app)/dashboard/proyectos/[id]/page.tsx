"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useLocale, useT } from "@/i18n/provider";
import { withLocale } from "@/lib/paths";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getProject, saveProject, type ProjectLink, type StoredProject } from "@/lib/projects-repository";
import { KIND_PATH, type ReportKind } from "@/lib/reports/types";
import { toast } from "sonner";

/** Maps worksheet `tool_id` → dashboard path (refId on worksheet links). */
const WORKSHEET_PATH: Record<string, string> = {
  "tam-sam-som": "/dashboard/modulos/estrategia/tam-sam-som",
  "fit-estrategico": "/dashboard/modulos/estrategia/fit-estrategico",
  "account-mapping": "/dashboard/modulos/estrategia/account-mapping",
  benchmarking: "/dashboard/modulos/mercado/benchmarking",
  modelos: "/dashboard/modulos/finanzas/modelos",
  "estructura-capital": "/dashboard/modulos/finanzas/estructura-capital",
  sensibilidad: "/dashboard/modulos/finanzas/sensibilidad",
  "riesgo-credito": "/dashboard/modulos/finanzas/riesgo-credito",
  "patentes-fto": "/dashboard/modulos/scouting/patentes-fto",
};

const REPORT_KINDS = new Set<string>(["estado_arte", "informe_mercado", "social_listening"]);

export default function ProjectDetailPage() {
  const t = useT();
  const { locale } = useLocale();
  const { user } = useAuth();
  const params = useParams();
  const id = String(params.id ?? "");
  const [project, setProject] = useState<StoredProject | null>(null);
  const [label, setLabel] = useState("");
  const [refId, setRefId] = useState("");
  const [kind, setKind] = useState<ProjectLink["kind"]>("report");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void getProject(id).then((p) => {
      if (!cancelled) setProject(p ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function addLink() {
    if (!project || !refId.trim()) return;
    const link: ProjectLink = {
      id: crypto.randomUUID(),
      kind,
      refId: refId.trim(),
      label: label.trim() || refId.trim(),
      createdAt: new Date().toISOString(),
    };
    const next = { ...project, links: [...project.links, link] };
    const saved = await saveProject(next);
    setProject(saved);
    setLabel("");
    setRefId("");
    toast.success(t("projects.linkAdded"));
  }

  function hrefFor(link: ProjectLink): string {
    if (link.kind === "bulletin") return withLocale(locale, `/dashboard/boletines/${link.refId}`);
    if (link.kind === "report") {
      // Optional "kind:id" or plain report id (defaults to estado del arte list/detail)
      const [maybeKind, maybeId] = link.refId.includes(":")
        ? (link.refId.split(":", 2) as [string, string])
        : ["estado_arte", link.refId];
      const base =
        REPORT_KINDS.has(maybeKind) && maybeId
          ? `${KIND_PATH[maybeKind as ReportKind]}/${maybeId}`
          : `/dashboard/estado-del-arte/${link.refId}`;
      return withLocale(locale, base);
    }
    if (link.kind === "worksheet") {
      const path = WORKSHEET_PATH[link.refId] ?? "/dashboard";
      return withLocale(locale, path);
    }
    if (link.kind === "other" && link.refId.startsWith("memo:")) {
      return withLocale(locale, "/dashboard/modulos/finanzas/memo-inversion");
    }
    return withLocale(locale, "/dashboard/proyectos");
  }

  if (!project) {
    return (
      <div className="space-y-4">
        <Link href={withLocale(locale, "/dashboard/proyectos")} className="text-sm text-muted-foreground hover:text-foreground">
          ← {t("common.back")}
        </Link>
        <p className="text-sm text-muted-foreground">{t("projects.notFound")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href={withLocale(locale, "/dashboard/proyectos")} className="text-sm text-muted-foreground hover:text-foreground">
          ← {t("common.back")}
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">{project.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {project.status}
          {project.description ? ` · ${project.description}` : ""}
        </p>
        {user ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {t("dashboard.org")} {user.organizationName ?? "—"}
          </p>
        ) : null}
      </div>

      <section>
        <h2 className="mb-3 font-semibold">{t("projects.linked")}</h2>
        {project.links.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("projects.noLinks")}</p>
        ) : (
          <ul className="space-y-2">
            {project.links.map((link) => (
              <li key={link.id}>
                <Link href={hrefFor(link)} className="block rounded-xl border bg-card p-4 hover:border-signal">
                  <p className="font-medium">{link.label || link.refId}</p>
                  <p className="text-sm text-muted-foreground">
                    {link.kind} · {link.refId}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border p-4">
        <h2 className="font-semibold">{t("projects.addLink")}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <Label>{t("projects.linkKind")}</Label>
            <select
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={kind}
              onChange={(e) => setKind(e.target.value as ProjectLink["kind"])}
            >
              <option value="report">report</option>
              <option value="bulletin">bulletin</option>
              <option value="worksheet">worksheet</option>
              <option value="other">other</option>
            </select>
          </div>
          <div>
            <Label>{t("projects.linkRef")}</Label>
            <Input
              value={refId}
              onChange={(e) => setRefId(e.target.value)}
              placeholder={
                kind === "worksheet"
                  ? "tam-sam-som"
                  : kind === "report"
                    ? "uuid o estado_arte:uuid"
                    : "id"
              }
            />
          </div>
          <div>
            <Label>{t("projects.linkLabel")}</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
        </div>
        <Button className="mt-4" disabled={!refId.trim()} onClick={() => void addLink()}>
          {t("projects.addLink")}
        </Button>
      </section>
    </div>
  );
}
