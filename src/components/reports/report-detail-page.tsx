"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Download, Printer } from "lucide-react";
import { getReport } from "@/lib/reports/reports-repository";
import { KIND_PATH, type ReportKind, type StoredReport } from "@/lib/reports/types";
import { ReportMarkdown } from "@/components/reports/report-tool-page";
import { useLocale, useT } from "@/i18n/provider";
import { withLocale } from "@/lib/paths";
import Link from "next/link";
import { Button } from "@/components/ui/button";

function downloadMarkdown(filename: string, markdown: string) {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".md") ? filename : `${filename}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportDetailPage({ kind }: { kind: ReportKind }) {
  const t = useT();
  const { locale } = useLocale();
  const params = useParams<{ id: string }>();
  const [report, setReport] = useState<StoredReport | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void getReport(params.id).then((found) => {
      if (cancelled) return;
      setReport(found && found.kind === kind ? found : null);
    });
    return () => {
      cancelled = true;
    };
  }, [params.id, kind]);

  if (report === undefined) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  if (!report) return <p className="text-sm text-muted-foreground">{t("tools.notFound")}</p>;

  return (
    <div className="print-report mx-auto max-w-3xl space-y-6">
      <Link
        href={withLocale(locale, KIND_PATH[kind])}
        className="no-print text-sm text-muted-foreground hover:text-foreground"
      >
        ← {t("common.back")}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{t(`tools.status.${report.status}`)}</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">{report.title}</h1>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" />
            {t("tools.printPdf")}
          </Button>
          {report.markdown ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                downloadMarkdown(
                  report.title.replace(/[^\w\-]+/g, "_").slice(0, 60) || "informe",
                  report.markdown,
                )
              }
            >
              <Download className="size-4" />
              {t("tools.downloadMarkdown")}
            </Button>
          ) : null}
        </div>
      </div>
      {report.sources.length > 0 ? (
        <details className="rounded-xl border bg-card p-4 text-sm">
          <summary className="cursor-pointer font-medium">{t("tools.sources")}</summary>
          <ul className="mt-3 space-y-2 text-muted-foreground">
            {report.sources.map((s, i) => (
              <li key={`${s.title}-${i}`}>
                <span className="font-medium text-foreground">{s.title}</span>
                {s.url ? (
                  <>
                    {" · "}
                    <a className="underline" href={s.url} target="_blank" rel="noreferrer">
                      {s.url}
                    </a>
                  </>
                ) : null}
                <p>{s.snippet}</p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <div className="rounded-xl border bg-card p-6">
        {report.markdown ? <ReportMarkdown markdown={report.markdown} /> : <p>{t("tools.incomplete")}</p>}
      </div>
    </div>
  );
}
