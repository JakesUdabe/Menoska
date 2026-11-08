"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useT } from "@/i18n/provider";
import { Field, NumberInput, ResultStat, TextInput, ToolWorkspace } from "@/components/modules/tool-workspace";
import { usePersistedWorksheet } from "@/lib/hooks/use-persisted-worksheet";

type State = { segment: string; selfScore: number; rivalA: number; rivalB: number; rivalC: number };

export default function BenchmarkingPage() {
  const t = useT();
  const [state, setState] = usePersistedWorksheet<State>("benchmarking", {
    segment: "Industrial IoT",
    selfScore: 72,
    rivalA: 81,
    rivalB: 64,
    rivalC: 58,
  });
  const { segment, selfScore, rivalA, rivalB, rivalC } = state;

  const data = useMemo(
    () => [
      { name: "Tú", score: selfScore },
      { name: "Rival A", score: rivalA },
      { name: "Rival B", score: rivalB },
      { name: "Rival C", score: rivalC },
    ],
    [selfScore, rivalA, rivalB, rivalC],
  );

  const rank = [...data].sort((a, b) => b.score - a.score).findIndex((d) => d.name === "Tú") + 1;
  const gap = Math.max(rivalA, rivalB, rivalC) - selfScore;

  return (
    <ToolWorkspace
      badge={t("sidebar.mercado")}
      title={t("tools.benchmarking")}
      description={t("tools.benchmarkingLead")}
      exportLabel={t("tools.exportJson")}
      exportData={{ segment, selfScore, rivalA, rivalB, rivalC, rank, gap, data }}
      inputs={
        <div className="space-y-4">
          <Field label="Segmento">
            <TextInput value={segment} onChange={(segment) => setState((s) => ({ ...s, segment }))} />
          </Field>
          <Field label="Tu puntuación (0–100)">
            <NumberInput value={selfScore} onChange={(selfScore) => setState((s) => ({ ...s, selfScore }))} min={0} max={100} />
          </Field>
          <Field label="Rival A">
            <NumberInput value={rivalA} onChange={(rivalA) => setState((s) => ({ ...s, rivalA }))} min={0} max={100} />
          </Field>
          <Field label="Rival B">
            <NumberInput value={rivalB} onChange={(rivalB) => setState((s) => ({ ...s, rivalB }))} min={0} max={100} />
          </Field>
          <Field label="Rival C">
            <NumberInput value={rivalC} onChange={(rivalC) => setState((s) => ({ ...s, rivalC }))} min={0} max={100} />
          </Field>
        </div>
      }
      results={
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat label="Segmento" value={segment.slice(0, 14) || "—"} />
            <ResultStat label="Tu ranking" value={`#${rank}`} accent />
            <ResultStat label="Gap vs líder" value={`${gap > 0 ? "+" : ""}${gap}`} />
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d5deda" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="score" fill="#00895B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-sm text-muted-foreground">
            Ajusta las puntuaciones (producto, go-to-market, IP, precio) para ver el posicionamiento relativo en {segment || "el segmento"}.
          </p>
        </div>
      }
    />
  );
}
