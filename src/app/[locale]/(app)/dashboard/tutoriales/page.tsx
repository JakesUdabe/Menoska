"use client";

import { Bell, BookOpen, CheckCircle2, ClipboardList, FileText, Lightbulb, LineChart, List, Scale, Search, Target } from "lucide-react";
import { useT } from "@/i18n/provider";
import { Card, CardContent } from "@/components/ui/card";

function TutorialSection({
  title,
  icon: Icon,
  steps,
}: {
  title: string;
  icon: typeof Search;
  steps: Array<{ icon: typeof Search; title: string; desc: string }>;
}) {
  const t = useT();
  return (
    <section className="mb-12 last:mb-0">
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-xl bg-primary p-2.5 text-primary-foreground">
          <Icon className="size-5" />
        </div>
        <h2 className="text-2xl font-bold">{title}</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {steps.map((step, i) => (
          <Card key={step.title} className="group transition-shadow hover:shadow-md">
            <CardContent className="flex gap-4 p-6">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground">
                <step.icon className="size-5" />
              </div>
              <div>
                <p className="mb-1 text-xs font-bold text-muted-foreground">{t("tutorials.step", { num: i + 1 })}</p>
                <h3 className="mb-1 font-bold">{step.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

export default function TutorialsPage() {
  const t = useT();
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold tracking-tight">{t("tutorials.title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("tutorials.subtitle")}</p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{t("tutorials.overview")}</p>
      </div>
      <TutorialSection
        title={t("tutorials.bulletinsTitle")}
        icon={List}
        steps={[
          { icon: Target, title: t("tutorials.b1t"), desc: t("tutorials.b1d") },
          { icon: Search, title: t("tutorials.b2t"), desc: t("tutorials.b2d") },
          { icon: Bell, title: t("tutorials.b3t"), desc: t("tutorials.b3d") },
          { icon: FileText, title: t("tutorials.b4t"), desc: t("tutorials.b4d") },
        ]}
      />
      <TutorialSection
        title={t("tutorials.ftoTitle")}
        icon={Scale}
        steps={[
          { icon: ClipboardList, title: t("tutorials.f1t"), desc: t("tutorials.f1d") },
          { icon: Search, title: t("tutorials.f2t"), desc: t("tutorials.f2d") },
          { icon: Scale, title: t("tutorials.f3t"), desc: t("tutorials.f3d") },
        ]}
      />
      <TutorialSection
        title={t("tutorials.estadoTitle")}
        icon={BookOpen}
        steps={[
          { icon: Lightbulb, title: t("tutorials.e1t"), desc: t("tutorials.e1d") },
          { icon: CheckCircle2, title: t("tutorials.e2t"), desc: t("tutorials.e2d") },
          { icon: FileText, title: t("tutorials.e3t"), desc: t("tutorials.e3d") },
        ]}
      />
      <TutorialSection
        title={t("tutorials.mercadoTitle")}
        icon={LineChart}
        steps={[
          { icon: Target, title: t("tutorials.m1t"), desc: t("tutorials.m1d") },
          { icon: Search, title: t("tutorials.m2t"), desc: t("tutorials.m2d") },
          { icon: FileText, title: t("tutorials.m3t"), desc: t("tutorials.m3d") },
        ]}
      />
    </div>
  );
}
