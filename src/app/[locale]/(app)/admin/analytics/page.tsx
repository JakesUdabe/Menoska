"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useLocale, useT } from "@/i18n/provider";
import { withLocale } from "@/lib/paths";
import { isOrgAdmin } from "@/lib/rbac";
import {
  countAnalyticsByEvent,
  listLocalAnalyticsBuffer,
  type AnalyticsBufferEvent,
} from "@/lib/analytics";
import { getNpsAggregate, type NpsAggregate } from "@/lib/nps-aggregate";
import { isSupabaseConfigured, createClient } from "@/lib/supabase/client";

export default function AdminAnalyticsPage() {
  const t = useT();
  const { locale } = useLocale();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<AnalyticsBufferEvent[]>([]);
  const [nps, setNps] = useState<NpsAggregate>({ average: null, count: 0, source: "empty" });

  useEffect(() => {
    if (!loading && (!user || !isOrgAdmin(user.role))) {
      router.replace(withLocale(locale, "/admin"));
    }
  }, [loading, user, locale, router]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const local = listLocalAnalyticsBuffer(80);
      let remote: AnalyticsBufferEvent[] = [];
      if (isSupabaseConfigured()) {
        try {
          const supabase = createClient();
          const { data } = await supabase
            .from("mc_analytics_events")
            .select("event, props, created_at")
            .order("created_at", { ascending: false })
            .limit(80);
          remote = (data ?? []).map((row) => ({
            event: String((row as { event?: string }).event ?? "unknown"),
            props: ((row as { props?: Record<string, unknown> }).props ?? {}) as AnalyticsBufferEvent["props"],
            at: String((row as { created_at?: string }).created_at ?? new Date().toISOString()),
          }));
        } catch {
          /* ignore */
        }
      }
      if (!cancelled) setEvents(remote.length ? remote : local);
      const agg = await getNpsAggregate();
      if (!cancelled) setNps(agg);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => countAnalyticsByEvent(events), [events]);
  const countEntries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  if (loading || !user || !isOrgAdmin(user.role)) {
    return <div className="p-4 text-sm text-muted-foreground">{t("common.loading")}</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">{t("analytics.eyebrow")}</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">{t("analytics.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("analytics.lead")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("analytics.npsAvg")}</p>
          <p className="mt-1 font-display text-3xl font-semibold text-primary">
            {nps.average == null ? "—" : nps.average}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("analytics.npsCount")}: {nps.count} · {nps.source}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("analytics.eventsTotal")}</p>
          <p className="mt-1 font-display text-3xl font-semibold">{events.length}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-lg font-semibold">{t("analytics.byEvent")}</h2>
        {countEntries.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t("analytics.empty")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {countEntries.map(([event, n]) => (
              <li key={event} className="flex items-center justify-between py-2 text-sm">
                <span className="font-mono text-xs">{event}</span>
                <span className="font-semibold">{n}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-lg font-semibold">{t("analytics.recent")}</h2>
        <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto">
          {events.slice(0, 40).map((e, i) => (
            <li key={`${e.at}-${e.event}-${i}`} className="rounded-lg border border-border/60 px-3 py-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono font-medium text-primary">{e.event}</span>
                <span className="text-muted-foreground">{new Date(e.at).toLocaleString()}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
