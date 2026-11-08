"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useT } from "@/i18n/provider";
import { writeStorage, readMigratedStorage } from "@/lib/storage-keys";
import { Label } from "@/components/ui/label";

const OPT_IN_KEY = "menoska_benchmarks_opt_in";

const DEMO_CHARTS = [
  { sector: "Automotive", medianTamM: 420, peerP50: 380, peerP75: 510 },
  { sector: "Cleantech", medianTamM: 610, peerP50: 540, peerP75: 780 },
  { sector: "Healthtech", medianTamM: 290, peerP50: 260, peerP75: 340 },
];

export default function BenchmarksPage() {
  const t = useT();
  const [optIn, setOptIn] = useState(false);

  useEffect(() => {
    try {
      setOptIn(readMigratedStorage(OPT_IN_KEY, "abi_benchmarks_opt_in") === "1");
    } catch {
      setOptIn(false);
    }
  }, []);

  function toggleOptIn(next: boolean) {
    setOptIn(next);
    try {
      writeStorage(OPT_IN_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  const data = useMemo(() => DEMO_CHARTS, []);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">{t("benchmarks.eyebrow")}</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">{t("benchmarks.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("benchmarks.lead")}</p>
      </div>

      <label className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm">
        <input
          type="checkbox"
          checked={optIn}
          onChange={(e) => toggleOptIn(e.target.checked)}
          className="size-4 accent-[var(--primary)]"
        />
        <span>
          <Label className="font-medium">{t("benchmarks.optIn")}</Label>
          <span className="mt-0.5 block text-xs text-muted-foreground">{t("benchmarks.optInLead")}</span>
        </span>
      </label>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("benchmarks.demoLabel")}
        </p>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="sector" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="medianTamM" name="TAM mediana (M€)" fill="#00895B" radius={[4, 4, 0, 0]} />
              <Bar dataKey="peerP50" name="Peer P50" fill="#394A51" radius={[4, 4, 0, 0]} />
              <Bar dataKey="peerP75" name="Peer P75" fill="#00895B99" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
