"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getReport } from "@/lib/reports/reports-store";
import { KIND_PATH, type ReportKind, type StoredReport } from "@/lib/reports/types";
import { ReportMarkdown } from "@/components/reports/report-tool-page";
import { useLocale, useT } from "@/i18n/provider";
import { withLocale } from "@/lib/paths";
import Link from "next/link";

export function ReportDetailPage({ kind }: { kind: ReportKind }) {
  const t = useT();
  const { locale } = useLocale();
  const params = useParams<{ id: string }>();
  const [report, setReport] = useState<StoredReport | null | undefined>(undefined);

  useEffect(() => {
    const found = getReport(params.id);
    setReport(found && found.kind === kind ? found : null);
  }, [params.id, kind]);

  if (report === undefined) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  if (!report) return <p className="text-sm text-muted-foreground">{t("tools.notFound")}</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={withLocale(locale, KIND_PATH[kind])} className="text-sm text-muted-foreground hover:text-foreground">
        ← {t("common.back")}
      </Link>
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{t(`tools.status.${report.status}`)}</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">{report.title}</h1>
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
