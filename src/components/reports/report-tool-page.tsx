"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { useLocale, useT } from "@/i18n/provider";
import { withLocale } from "@/lib/paths";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isOrgAdmin } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { getReportTemplate } from "@/lib/reports/templates-store";
import { deleteReport, getReport, listReportsForUser, newReportId, upsertReport } from "@/lib/reports/reports-store";
import { KIND_PATH, type ReportKind, type StoredReport } from "@/lib/reports/types";

const STEPS = ["questionnaire", "confirm", "ready"] as const;

export function ReportMarkdown({ markdown }: { markdown: string }) {
  const blocks = markdown.split(/\n{2,}/);
  return (
    <article className="prose-abi max-w-none space-y-4 text-sm leading-relaxed">
      {blocks.map((block, i) => {
        const line = block.trim();
        if (line.startsWith("# ")) return <h1 key={i} className="font-display text-2xl font-bold">{line.slice(2)}</h1>;
        if (line.startsWith("## ")) return <h2 key={i} className="font-display text-xl font-semibold">{line.slice(3)}</h2>;
        if (line.startsWith("### ")) return <h3 key={i} className="text-lg font-semibold">{line.slice(4)}</h3>;
        if (line.startsWith("- ")) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {line.split("\n").map((item, j) => (
                <li key={j}>{item.replace(/^- /, "")}</li>
              ))}
            </ul>
          );
        }
        return <p key={i} className="whitespace-pre-wrap text-foreground/90">{line}</p>;
      })}
    </article>
  );
}

export function ReportToolPage({ kind }: { kind: ReportKind }) {
  const t = useT();
  const { locale } = useLocale();
  const { user } = useAuth();
  const router = useRouter();
  const seeOrg = isOrgAdmin(user?.role);
  const [template, setTemplate] = useState(() => getReportTemplate(kind));
  const [items, setItems] = useState<StoredReport[]>([]);
  const [step, setStep] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTemplate(getReportTemplate(kind));
    setStep(null);
  }, [kind]);

  useEffect(() => {
    if (!user) return;
    setItems(listReportsForUser(user.id, user.organizationId, seeOrg, kind));
  }, [user, seeOrg, kind]);

  const titleKey =
    kind === "estado_arte" ? "tools.estadoArte" : kind === "informe_mercado" ? "tools.informeMercado" : "tools.socialListening";
  const leadKey =
    kind === "estado_arte" ? "tools.estadoArteLead" : kind === "informe_mercado" ? "tools.informeMercadoLead" : "tools.socialLead";

  function refresh() {
    if (!user) return;
    setItems(listReportsForUser(user.id, user.organizationId, seeOrg, kind));
  }

  function startNew() {
    const initial: Record<string, string> = {};
    for (const q of template.cuestionario) initial[q.id] = "";
    setAnswers(initial);
    setStep(0);
  }

  function missingRequired() {
    return template.cuestionario.filter((q) => q.obligatorio && !(answers[q.id] ?? "").trim());
  }

  async function generate() {
    if (!user) return;
    const missing = missingRequired();
    if (missing.length) {
      toast.error(t("tools.fillRequired"));
      return;
    }
    setBusy(true);
    const title =
      answers.tema || answers.mercado || answers.marcas?.split("\n")[0] || answers.keywords?.split("\n")[0] || template.name;
    const draft: StoredReport = {
      id: newReportId(),
      kind,
      templateId: template.id,
      createdBy: user.id,
      organizationId: user.organizationId ?? "org-unknown",
      title,
      answers,
      markdown: "",
      sources: [],
      status: "generating",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    upsertReport(draft);
    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, answers, template }),
      });
      const data = (await res.json()) as { markdown?: string; sources?: StoredReport["sources"]; error?: string };
      if (!res.ok || !data.markdown) throw new Error(data.error ?? t("tools.generateError"));
      upsertReport({ ...draft, markdown: data.markdown, sources: data.sources ?? [], status: "ready" });
      toast.success(t("tools.generated"));
      router.push(withLocale(locale, `${KIND_PATH[kind]}/${draft.id}`));
    } catch (err) {
      upsertReport({ ...draft, status: "failed" });
      toast.error(err instanceof Error ? err.message : t("tools.generateError"));
      refresh();
    } finally {
      setBusy(false);
    }
  }

  if (step !== null) {
    return (
      <div className="mx-auto max-w-3xl">
        <button type="button" className="mb-6 text-sm text-muted-foreground hover:text-foreground" onClick={() => setStep(null)}>
          ← {t("common.back")}
        </button>
        <div className="mb-10 flex items-center">
          {STEPS.map((key, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <div key={key} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={cn(
                      "flex size-9 items-center justify-center rounded-full border-2 text-sm font-bold",
                      done ? "border-emerald-500 bg-emerald-500 text-white" : active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground",
                    )}
                  >
                    {done ? <CheckCircle2 className="size-4" /> : i + 1}
                  </div>
                  <span className="hidden text-[10px] font-semibold uppercase tracking-wider sm:block">{t(`tools.step.${key}`)}</span>
                </div>
                {i < STEPS.length - 1 ? <div className={cn("mx-2 h-0.5 flex-1", done ? "bg-emerald-400" : "bg-border")} /> : null}
              </div>
            );
          })}
        </div>

        {step === 0 ? (
          <div className="space-y-5">
            <h1 className="font-display text-2xl font-bold">{t("tools.questionnaire")}</h1>
            <p className="text-sm text-muted-foreground">{template.description}</p>
            {template.cuestionario.map((q) => (
              <div key={q.id}>
                <Label htmlFor={q.id}>
                  {q.titulo}
                  {q.obligatorio ? " *" : ""}
                </Label>
                {q.descripcion ? <p className="mb-1 text-xs text-muted-foreground">{q.descripcion}</p> : null}
                {q.tipo === "textarea" ? (
                  <Textarea id={q.id} rows={4} value={answers[q.id] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} />
                ) : (
                  <Input
                    id={q.id}
                    type={q.tipo === "numero" ? "number" : "text"}
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  />
                )}
              </div>
            ))}
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  if (missingRequired().length) {
                    toast.error(t("tools.fillRequired"));
                    return;
                  }
                  setStep(1);
                }}
              >
                {t("common.continue")} <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-5">
            <h1 className="font-display text-2xl font-bold">{t("tools.confirm")}</h1>
            <div className="space-y-3 rounded-xl border bg-card p-5">
              {template.cuestionario.map((q) => (
                <div key={q.id}>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">{q.titulo}</p>
                  <p className="whitespace-pre-wrap text-sm">{answers[q.id] || "—"}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(0)}>
                <ChevronLeft className="size-4" /> {t("common.back")}
              </Button>
              <Button onClick={() => void generate()} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                {busy ? t("tools.generating") : t("tools.generate")}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">{t(titleKey)}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t(leadKey)}</p>
        </div>
        <Button onClick={startNew}>{t("tools.newReport")}</Button>
      </div>
      <ul className="mt-8 space-y-3">
        {items.length === 0 ? <p className="text-sm text-muted-foreground">{t("tools.empty")}</p> : null}
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2">
            <button
              type="button"
              className="flex-1 rounded-xl border bg-card p-4 text-left hover:border-signal"
              onClick={() => {
                const full = getReport(item.id);
                if (full?.markdown) router.push(withLocale(locale, `${KIND_PATH[kind]}/${item.id}`));
                else toast.message(t("tools.incomplete"));
              }}
            >
              <p className="font-medium">{item.title}</p>
              <p className="text-sm text-muted-foreground">{t(`tools.status.${item.status}`)}</p>
            </button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                deleteReport(item.id);
                refresh();
              }}
              aria-label={t("common.delete")}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
