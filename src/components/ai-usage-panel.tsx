"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { useLocale, useT } from "@/i18n/provider";
import { withLocale } from "@/lib/paths";
import { listRecentUsage, type ClientAiUsageEvent } from "@/lib/ai/usage-store";
import { demoApiHeaders } from "@/lib/api/demo-headers";

function kindLabel(kind: string, t: (k: string) => string) {
  if (kind === "nl_query") return t("usage.kindNl");
  if (kind === "report_generate") return t("usage.kindReport");
  return kind;
}

function formatAt(iso: string, locale: string) {
  try {
    return new Date(iso).toLocaleString(locale);
  } catch {
    return iso;
  }
}

/** Compact strip for dashboard home (last few events). */
export function AiUsageStrip() {
  const t = useT();
  const { locale } = useLocale();
  const { user } = useAuth();
  const [events, setEvents] = useState<ClientAiUsageEvent[]>([]);

  useEffect(() => {
    if (!user) return;
    setEvents(listRecentUsage(user.id, 3));
  }, [user]);

  if (!user || events.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card/60 px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("usage.recent")}</p>
        <Link href={withLocale(locale, "/dashboard/facturacion")} className="text-xs text-primary hover:underline">
          {t("usage.viewAll")}
        </Link>
      </div>
      <ul className="space-y-1 text-sm">
        {events.map((e) => (
          <li key={e.id} className="flex justify-between gap-3 text-muted-foreground">
            <span className="truncate text-foreground">{kindLabel(e.kind, t)}</span>
            <span className="shrink-0 font-mono text-[11px]">{formatAt(e.at, locale)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Full panel for billing page (last 10; merges API when Supabase is live). */
export function AiUsagePanel() {
  const t = useT();
  const { locale } = useLocale();
  const { user } = useAuth();
  const [events, setEvents] = useState<ClientAiUsageEvent[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const local = listRecentUsage(user.id, 10);

    void (async () => {
      try {
        const res = await fetch("/api/usage", { headers: { ...demoApiHeaders(user) } });
        if (!res.ok) {
          if (!cancelled) setEvents(local);
          return;
        }
        const data = (await res.json()) as { events?: ClientAiUsageEvent[]; demo?: boolean };
        if (cancelled) return;
        if (data.demo || !data.events?.length) {
          setEvents(local);
          return;
        }
        setEvents(data.events.slice(0, 10));
      } catch {
        if (!cancelled) setEvents(local);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 className="font-display text-lg font-semibold">{t("usage.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("usage.lead")}</p>
      </div>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("usage.empty")}</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border">
          {events.map((e) => (
            <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2.5 text-sm">
              <span className="font-medium">{kindLabel(e.kind, t)}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{formatAt(e.at, locale)}</span>
              {(e.tokensIn || e.tokensOut) ? (
                <span className="w-full text-xs text-muted-foreground">
                  {t("usage.tokens")}: {(e.tokensIn ?? 0) + (e.tokensOut ?? 0)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
