"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { useT } from "@/i18n/provider";
import { useAuth } from "@/components/auth-provider";
import { isSuperAdmin } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FIELD_TYPES,
  MODEL_TIERS,
  REPORT_KINDS,
  REPORT_RESOURCES,
  blankPrompt,
  blankQuestion,
  blankSection,
  nextPrefixedId,
  type PlantillaSeccion,
  type QuestionnaireField,
  type ReportKind,
  type ReportTemplate,
} from "@/lib/reports/types";
import {
  getReportTemplate,
  resetReportTemplate,
  saveReportTemplate,
} from "@/lib/reports/templates-repository";
import { getReportTemplate as getLocalTemplate } from "@/lib/reports/templates-store";

const KIND_LABEL: Record<ReportKind, string> = {
  estado_arte: "tools.estadoArte",
  informe_mercado: "tools.informeMercado",
  social_listening: "tools.socialListening",
};

export default function AdminTemplatesPage() {
  const t = useT();
  const { user } = useAuth();
  const [kind, setKind] = useState<ReportKind>("estado_arte");
  const [template, setTemplate] = useState<ReportTemplate>(() => getLocalTemplate("estado_arte"));

  useEffect(() => {
    let cancelled = false;
    void getReportTemplate(kind).then((tpl) => {
      if (!cancelled) setTemplate(tpl);
    });
    return () => {
      cancelled = true;
    };
  }, [kind]);

  function load(next: ReportKind) {
    setKind(next);
  }

  const questionIds = useMemo(() => template.cuestionario.map((q) => q.id), [template.cuestionario]);

  if (!isSuperAdmin(user?.role)) {
    return <p className="text-sm text-muted-foreground">{t("admin.superadminOnly")}</p>;
  }

  function updateQuestion(index: number, patch: Partial<QuestionnaireField>) {
    setTemplate((prev) => {
      const cuestionario = prev.cuestionario.map((q, i) => (i === index ? { ...q, ...patch } : q));
      return { ...prev, cuestionario };
    });
  }

  function updateSection(index: number, patch: Partial<PlantillaSeccion>) {
    setTemplate((prev) => {
      const secciones = prev.secciones.map((s, i) => (i === index ? { ...s, ...patch } : s));
      return { ...prev, secciones };
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">{t("admin.templates")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("admin.templatesLead")}</p>
      </div>
      <Tabs value={kind} onValueChange={(v) => load(v as ReportKind)}>
        <TabsList className="flex h-auto flex-wrap">
          {REPORT_KINDS.map((k) => (
            <TabsTrigger key={k} value={k}>
              {t(KIND_LABEL[k])}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>{t("admin.templateName")}</Label>
          <Input value={template.name} onChange={(e) => setTemplate((p) => ({ ...p, name: e.target.value }))} />
        </div>
        <div>
          <Label>{t("admin.templateDesc")}</Label>
          <Input value={template.description} onChange={(e) => setTemplate((p) => ({ ...p, description: e.target.value }))} />
        </div>
      </div>

      <Tabs defaultValue="cuestionario">
        <TabsList>
          <TabsTrigger value="cuestionario">{t("admin.tabQuestionnaire")}</TabsTrigger>
          <TabsTrigger value="plantilla">{t("admin.tabTemplate")}</TabsTrigger>
        </TabsList>
        <TabsContent value="cuestionario" className="space-y-4 pt-4">
          {template.cuestionario.map((q, index) => (
            <div key={q.id} className="space-y-3 rounded-xl border p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label>ID</Label>
                  <Input value={q.id} onChange={(e) => updateQuestion(index, { id: e.target.value.replace(/\s+/g, "_") })} />
                </div>
                <div>
                  <Label>{t("admin.questionTitle")}</Label>
                  <Input value={q.titulo} onChange={(e) => updateQuestion(index, { titulo: e.target.value })} />
                </div>
                <div>
                  <Label>{t("admin.questionType")}</Label>
                  <select
                    className="mt-0 flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                    value={q.tipo}
                    onChange={(e) => updateQuestion(index, { tipo: e.target.value as QuestionnaireField["tipo"] })}
                  >
                    {FIELD_TYPES.map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {tipo}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <Label>{t("admin.questionDesc")}</Label>
                <Input value={q.descripcion} onChange={(e) => updateQuestion(index, { descripcion: e.target.value })} />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={q.obligatorio} onCheckedChange={(v) => updateQuestion(index, { obligatorio: v === true })} />
                  {t("admin.required")}
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTemplate((p) => ({ ...p, cuestionario: p.cuestionario.filter((_, i) => i !== index) }))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
          <Button
            variant="outline"
            onClick={() =>
              setTemplate((p) => ({
                ...p,
                cuestionario: [...p.cuestionario, blankQuestion(nextPrefixedId("q", p.cuestionario.map((x) => x.id)))],
              }))
            }
          >
            <Plus className="size-4" /> {t("admin.addQuestion")}
          </Button>
        </TabsContent>
        <TabsContent value="plantilla" className="space-y-4 pt-4">
          {template.secciones.map((section, sIndex) => (
            <div key={section.id} className="space-y-4 rounded-xl border p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>ID</Label>
                  <Input value={section.id} onChange={(e) => updateSection(sIndex, { id: e.target.value.replace(/\s+/g, "_") })} />
                </div>
                <div>
                  <Label>{t("admin.sectionTitle")}</Label>
                  <Input value={section.titulo} onChange={(e) => updateSection(sIndex, { titulo: e.target.value })} />
                </div>
              </div>
              {section.prompts.map((prompt, pIndex) => (
                <div key={prompt.id} className="space-y-3 rounded-lg border bg-muted/30 p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>{t("admin.promptTitle")}</Label>
                      <Input
                        value={prompt.titulo}
                        onChange={(e) => {
                          const prompts = section.prompts.map((pr, i) => (i === pIndex ? { ...pr, titulo: e.target.value } : pr));
                          updateSection(sIndex, { prompts });
                        }}
                      />
                    </div>
                    <div>
                      <Label>{t("admin.model")}</Label>
                      <select
                        className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                        value={prompt.modelo}
                        onChange={(e) => {
                          const prompts = section.prompts.map((pr, i) =>
                            i === pIndex ? { ...pr, modelo: e.target.value as (typeof MODEL_TIERS)[number] } : pr,
                          );
                          updateSection(sIndex, { prompts });
                        }}
                      >
                        {MODEL_TIERS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <Label>{t("admin.prompt")}</Label>
                    <Textarea
                      rows={5}
                      value={prompt.prompt}
                      onChange={(e) => {
                        const prompts = section.prompts.map((pr, i) => (i === pIndex ? { ...pr, prompt: e.target.value } : pr));
                        updateSection(sIndex, { prompts });
                      }}
                    />
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium">{t("admin.resources")}</p>
                    <div className="flex flex-wrap gap-3">
                      {REPORT_RESOURCES.map((res) => {
                        const checked = prompt.recursos.includes(res);
                        return (
                          <label key={res} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                const recursos = v === true ? [...prompt.recursos, res] : prompt.recursos.filter((r) => r !== res);
                                const prompts = section.prompts.map((pr, i) => (i === pIndex ? { ...pr, recursos } : pr));
                                updateSection(sIndex, { prompts });
                              }}
                            />
                            {t(`admin.resource.${res}`)}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium">{t("admin.linkedQuestions")}</p>
                    <div className="flex flex-wrap gap-3">
                      {template.cuestionario.map((q) => {
                        const checked = prompt.preguntaIds.includes(q.id);
                        return (
                          <label key={q.id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                const preguntaIds =
                                  v === true ? [...prompt.preguntaIds, q.id] : prompt.preguntaIds.filter((id) => id !== q.id);
                                const prompts = section.prompts.map((pr, i) => (i === pIndex ? { ...pr, preguntaIds } : pr));
                                updateSection(sIndex, { prompts });
                              }}
                            />
                            {q.titulo || q.id}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      updateSection(sIndex, { prompts: section.prompts.filter((_, i) => i !== pIndex) })
                    }
                    disabled={section.prompts.length <= 1}
                  >
                    <Trash2 className="size-4" /> {t("admin.removePrompt")}
                  </Button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const ids = section.prompts.map((p) => p.id);
                    updateSection(sIndex, { prompts: [...section.prompts, blankPrompt(nextPrefixedId("p", ids))] });
                  }}
                >
                  <Plus className="size-4" /> {t("admin.addPrompt")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTemplate((p) => ({ ...p, secciones: p.secciones.filter((_, i) => i !== sIndex) }))}
                >
                  <Trash2 className="size-4" /> {t("admin.removeSection")}
                </Button>
              </div>
            </div>
          ))}
          <Button
            variant="outline"
            onClick={() => {
              const secIds = template.secciones.map((s) => s.id);
              const promptIds = template.secciones.flatMap((s) => s.prompts.map((p) => p.id));
              setTemplate((p) => ({
                ...p,
                secciones: [...p.secciones, blankSection(nextPrefixedId("sec", secIds), nextPrefixedId("p", promptIds))],
              }));
            }}
          >
            <Plus className="size-4" /> {t("admin.addSection")}
          </Button>
        </TabsContent>
      </Tabs>

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            void (async () => {
              try {
                const saved = await saveReportTemplate(template);
                setTemplate(saved);
                toast.success(t("admin.saved"));
              } catch (err) {
                toast.error(err instanceof Error ? err.message : t("admin.saveError"));
              }
            })();
          }}
        >
          {t("common.save")}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            void (async () => {
              setTemplate(await resetReportTemplate(kind));
              toast.success(t("admin.reset"));
            })();
          }}
        >
          {t("admin.reset")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {questionIds.length} {t("admin.questionsCount")} · {template.secciones.length} {t("admin.sectionsCount")}
      </p>
    </div>
  );
}
