import { isLocale, type Locale } from "@/i18n/locales";
import { createTranslator } from "@/i18n/server";
import { readFile } from "fs/promises";
import path from "path";

type StatusPayload = {
  status: string;
  updatedAt?: string;
  services: Array<{ id: string; name: string; status: string }>;
};

const FALLBACK: StatusPayload = {
  status: "operational",
  updatedAt: "2026-10-26T00:00:00.000Z",
  services: [
    { id: "web", name: "Aplicación web", status: "operational" },
    { id: "api", name: "API", status: "operational" },
    { id: "auth", name: "Autenticación", status: "operational" },
    { id: "bulletins", name: "Envío de boletines", status: "operational" },
    { id: "ai", name: "Generación IA", status: "operational" },
    { id: "billing", name: "Facturación", status: "operational" },
  ],
};

async function loadStatus(): Promise<StatusPayload> {
  try {
    const file = path.join(process.cwd(), "public", "status.json");
    const raw = await readFile(file, "utf8");
    const parsed = JSON.parse(raw) as StatusPayload;
    if (parsed?.status && Array.isArray(parsed.services)) return parsed;
  } catch {
    /* use fallback */
  }
  return FALLBACK;
}

function statusLabel(status: string, t: (k: string) => string): string {
  if (status === "operational") return t("status.operational");
  if (status === "degraded") return t("status.degraded");
  if (status === "outage") return t("status.outage");
  return status;
}

export default async function StatusPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "es") as Locale;
  const t = createTranslator(locale);
  const data = await loadStatus();

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-signal">{t("status.eyebrow")}</p>
      <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">{t("status.title")}</h1>
      <p className="mt-4 text-lg text-muted-foreground">{t("status.lead")}</p>
      <div className="mt-8 rounded-2xl border bg-card p-6">
        <p className="text-sm font-medium">
          {t("status.overall")}:{" "}
          <span className="text-signal">{statusLabel(data.status, t)}</span>
        </p>
        {data.updatedAt ? (
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {t("status.updated")}: {data.updatedAt}
          </p>
        ) : null}
        <ul className="mt-6 divide-y">
          {data.services.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-3 text-sm">
              <span>{s.name}</span>
              <span className="font-medium text-signal">{statusLabel(s.status, t)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
