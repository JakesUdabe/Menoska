"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { useLocale, useT } from "@/i18n/provider";
import { withLocale } from "@/lib/paths";
import { demoApiHeaders } from "@/lib/api/demo-headers";
import { usePersistedWorksheet } from "@/lib/hooks/use-persisted-worksheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, ResultStat } from "@/components/modules/tool-workspace";
import type { ComparedPatent, ElementVerdict, FtoReport } from "@/lib/fto/compare";
import { ftoCopy } from "@/lib/fto/copy";
import { showcaseRdf } from "@/lib/fto/corpus";
import {
  COMMERCIAL_ACTS,
  RDF_LIMITS,
  coerceRdf,
  validateRdf,
  type CommercialAct,
  type RdfField,
  type TechnicalRdf,
} from "@/lib/fto/rdf";
import { cn } from "@/lib/utils";

type ScreenResponse = FtoReport & { demo?: boolean; error?: string };

const SHORT: RdfField[] = ["productName", "jurisdictions", "cutoff", "ipc"];
const GROUPS: Array<{ id: "act" | "technical" | "elements" | "search"; fields: RdfField[] }> = [
  { id: "act", fields: ["productName", "commercialDetail", "jurisdictions", "cutoff"] },
  { id: "technical", fields: ["technicalProblem", "technicalEffect", "embodiment"] },
  { id: "elements", fields: ["essentialFeatures", "materialsParameters", "exclusions"] },
  { id: "search", fields: ["variants", "vocabulary", "ipc"] },
];

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function verdictClass(verdict: ElementVerdict) {
  if (verdict === "presente") return "bg-destructive/15 text-destructive";
  if (verdict === "parcial") return "bg-amber-500/15 text-amber-800";
  if (verdict === "fuera") return "bg-primary/15 text-primary";
  return "bg-muted text-muted-foreground";
}

export default function PatentesFtoPage() {
  const t = useT();
  const { locale } = useLocale();
  const copy = ftoCopy(locale);
  const { user } = useAuth();
  const [raw, setRaw] = usePersistedWorksheet<unknown>("patentes-fto", showcaseRdf());
  const form = coerceRdf(raw, showcaseRdf());
  const check = validateRdf(form);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ScreenResponse | null>(null);

  function update<K extends keyof TechnicalRdf>(key: K, value: TechnicalRdf[K]) {
    setRaw({ ...form, [key]: value });
  }

  function toggleAct(act: CommercialAct, checked: boolean) {
    const next = checked ? [...form.commercialActs, act] : form.commercialActs.filter((item) => item !== act);
    update("commercialActs", COMMERCIAL_ACTS.filter((item) => next.includes(item)));
  }

  async function run() {
    if (!check.ok) {
      toast.error(copy.incomplete);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/fto/screen", {
        method: "POST",
        headers: { "content-type": "application/json", ...demoApiHeaders(user) },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as ScreenResponse;
      if (res.status === 403 && data.error === "plan_required") {
        toast.error(t("bulletin.planRequired"), {
          action: {
            label: t("billing.upgrade"),
            onClick: () => {
              window.location.href = withLocale(locale, "/dashboard/facturacion");
            },
          },
        });
        return;
      }
      if (!res.ok || !data.patents) {
        toast.error(copy.incomplete);
        return;
      }
      setReport(data);
    } catch {
      toast.error(copy.incomplete);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="max-w-3xl">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-primary">{t("sidebar.scouting")}</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">{t("tools.patentesFto")}</h1>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">{t("tools.patentesFtoLead")}</p>
        <p className="mt-3 text-sm leading-7 text-foreground/80">{copy.method}</p>
      </header>

      <form
        className="space-y-8"
        onSubmit={(event) => {
          event.preventDefault();
          void run();
        }}
      >
        {GROUPS.map((group) => (
          <section key={group.id} className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <h2 className="font-display text-lg font-semibold">{copy.sections[group.id]}</h2>
            {group.id === "act" ? (
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-foreground">{copy.acts}</p>
                <div className="flex flex-wrap gap-3 pt-1">
                  {COMMERCIAL_ACTS.map((act) => (
                    <label key={act} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={form.commercialActs.includes(act)}
                        onCheckedChange={(checked) => toggleAct(act, checked === true)}
                      />
                      {copy.actLabel[act]}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{copy.actsHint}</p>
              </div>
            ) : null}
            {group.fields.map((field) => (
              <RdfFieldInput
                key={field}
                field={field}
                label={copy.fields[field].label}
                hint={copy.fields[field].hint}
                value={form[field]}
                onChange={(value) => update(field, value)}
              />
            ))}
            {group.id === "search" ? (
              <Field label={copy.known} hint={copy.knownHint}>
                <Input value={form.knownPatents} onChange={(event) => update("knownPatents", event.target.value)} />
              </Field>
            ) : null}
          </section>
        ))}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={busy || !check.ok}>
            {busy ? copy.running : copy.run}
          </Button>
          {!check.ok ? <p className="text-sm text-destructive">{copy.incomplete}</p> : null}
        </div>
      </form>

      <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">{copy.closest}</h2>
          {report ? (
            <button
              type="button"
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
              onClick={() => downloadJson("fto-rdf.json", { rdf: form, report })}
            >
              {copy.exportLabel}
            </button>
          ) : null}
        </div>
        <p className="text-sm leading-6 text-muted-foreground">{copy.disclaimer}</p>
        {!report ? <p className="text-sm text-muted-foreground">{copy.empty}</p> : <ReportView copy={copy} report={report} ipc={form.ipc} />}
      </section>
    </div>
  );
}

function RdfFieldInput({
  field,
  label,
  hint,
  value,
  onChange,
}: {
  field: RdfField;
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const min = RDF_LIMITS[field];
  const count = value.trim().length;
  const short = SHORT.includes(field);
  return (
    <Field label={label} hint={hint}>
      {short ? (
        <Input value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <Textarea
          value={value}
          rows={field === "embodiment" || field === "essentialFeatures" ? 8 : 5}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      <span className={cn("font-mono text-[11px]", count >= min ? "text-muted-foreground" : "text-destructive")}>
        {count}/{min}
      </span>
    </Field>
  );
}

function ReportView({ copy, report, ipc }: { copy: ReturnType<typeof ftoCopy>; report: ScreenResponse; ipc: string }) {
  return (
    <div className="space-y-5">
      {report.demo ? <p className="text-sm text-muted-foreground">{copy.demoNote}</p> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <ResultStat label={copy.families} value={String(report.patents.length)} />
        <ResultStat label={copy.classLabel} value={ipc || "—"} />
        <ResultStat label={copy.risk} value={`${report.risk} · ${report.riskScore}/100`} accent={report.risk === "Alto"} />
      </div>
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{copy.contexts}</p>
        <ul className="mt-2 space-y-1">
          {report.contexts.map((context) => (
            <li key={context.id} className="text-sm">
              <span className="font-medium">{context.label}. </span>
              <span className="text-muted-foreground">{context.query}</span>
            </li>
          ))}
        </ul>
      </div>
      <ul className="space-y-4">
        {report.patents.map((patent) => (
          <PatentCard key={patent.id} patent={patent} copy={copy} />
        ))}
      </ul>
    </div>
  );
}

function PatentCard({ patent, copy }: { patent: ComparedPatent; copy: ReturnType<typeof ftoCopy> }) {
  const { locale } = useLocale();
  const legal =
    patent.legalStatus === "alive"
      ? locale === "en" ? "In force" : "En vigor"
      : patent.legalStatus === "dead"
        ? locale === "en" ? "Not in force" : "No está en vigor"
        : patent.legalStatus === "pending"
          ? locale === "en" ? "Pending" : "Pendiente"
          : patent.legalStatus === "unknown"
            ? locale === "en" ? "Status unknown" : "Sin estado"
            : "";
  return (
    <li className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] text-muted-foreground">
            {patent.id} · {patent.year} · {Math.round(patent.closeness * 100)}%{legal ? ` · ${legal}` : ""}
          </p>
          <p className="mt-1 text-sm font-medium">{patent.title}</p>
          <p className="text-xs text-muted-foreground">{patent.assignee}</p>
          {patent.url ? (
            <a href={patent.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
              {patent.url.replace(/^https?:\/\//, "")}
            </a>
          ) : null}
        </div>
      </div>
      {patent.afterCutoff ? <p className="mt-2 text-xs text-amber-800">{copy.afterCutoff}</p> : null}
      <div className="mt-3 space-y-3">
        {patent.claims.map((claim) => (
          <article key={`${patent.id}-${claim.index}`} className="rounded-md bg-muted/40 p-3">
            <p className="text-xs font-medium">
              {copy.claim} {claim.index} · {copy.kind[claim.kind]}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{copy.source[claim.source]}</p>
            <p className="mt-2 text-sm leading-6">{claim.text}</p>
            <p className="mt-2 text-xs font-medium">{copy.reading[claim.reading]}</p>
            <ul className="mt-2 space-y-1.5">
              {claim.elements.map((element) => (
                <li key={element.text} className="flex items-start justify-between gap-3 text-sm">
                  <span>{element.text}</span>
                  <span className={cn("shrink-0 rounded px-2 py-0.5 font-mono text-[10px] uppercase", verdictClass(element.verdict))}>
                    {copy.verdict[element.verdict]}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </li>
  );
}
