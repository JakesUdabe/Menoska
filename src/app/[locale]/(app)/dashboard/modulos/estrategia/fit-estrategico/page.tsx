"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useT } from "@/i18n/provider";
import { Field, NumberInput, ResultStat, ToolWorkspace } from "@/components/modules/tool-workspace";
import { usePersistedWorksheet } from "@/lib/hooks/use-persisted-worksheet";

type State = {
  buySpeed: number;
  buyCost: number;
  buyControl: number;
  buildSpeed: number;
  buildCost: number;
  buildControl: number;
  partnerSpeed: number;
  partnerCost: number;
  partnerControl: number;
};

export default function FitEstrategicoPage() {
  const t = useT();
  const [state, setState] = usePersistedWorksheet<State>("fit-estrategico", {
    buySpeed: 8,
    buyCost: 4,
    buyControl: 5,
    buildSpeed: 3,
    buildCost: 7,
    buildControl: 9,
    partnerSpeed: 6,
    partnerCost: 8,
    partnerControl: 4,
  });

  const scores = useMemo(() => {
    const score = (speed: number, cost: number, control: number) => speed * 0.35 + cost * 0.3 + control * 0.35;
    const rows = [
      { name: "Buy", score: score(state.buySpeed, state.buyCost, state.buyControl) },
      { name: "Build", score: score(state.buildSpeed, state.buildCost, state.buildControl) },
      { name: "Partner", score: score(state.partnerSpeed, state.partnerCost, state.partnerControl) },
    ];
    const best = [...rows].sort((a, b) => b.score - a.score)[0];
    return { rows, best };
  }, [state]);

  const options: { label: string; keys: (keyof State)[] }[] = [
    { label: "Buy", keys: ["buySpeed", "buyCost", "buyControl"] },
    { label: "Build", keys: ["buildSpeed", "buildCost", "buildControl"] },
    { label: "Partner", keys: ["partnerSpeed", "partnerCost", "partnerControl"] },
  ];

  return (
    <ToolWorkspace
      badge={t("sidebar.estrategia")}
      title={t("tools.fitEstrategico")}
      description={t("tools.fitEstrategicoLead")}
      exportLabel={t("tools.exportJson")}
      exportData={{ ...state, scores: scores.rows, recommendation: scores.best }}
      inputs={
        <div className="space-y-5">
          {options.map((opt) => (
            <div key={opt.label} className="space-y-2 rounded-lg border border-border p-3">
              <p className="font-mono text-[11px] uppercase tracking-wider text-primary">{opt.label}</p>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Velocidad">
                  <NumberInput
                    value={state[opt.keys[0]]}
                    onChange={(v) => setState((s) => ({ ...s, [opt.keys[0]]: v }))}
                    min={1}
                    max={10}
                  />
                </Field>
                <Field label="Coste (↑ mejor)">
                  <NumberInput
                    value={state[opt.keys[1]]}
                    onChange={(v) => setState((s) => ({ ...s, [opt.keys[1]]: v }))}
                    min={1}
                    max={10}
                  />
                </Field>
                <Field label="Control">
                  <NumberInput
                    value={state[opt.keys[2]]}
                    onChange={(v) => setState((s) => ({ ...s, [opt.keys[2]]: v }))}
                    min={1}
                    max={10}
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>
      }
      results={
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <ResultStat label="Recomendación" value={scores.best.name} accent />
            <ResultStat label="Score" value={scores.best.score.toFixed(1)} />
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scores.rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d5deda" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 10]} />
                <Tooltip />
                <Bar dataKey="score" fill="#00895B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-sm text-muted-foreground">
            Ponderación demo: velocidad 35%, coste-eficiencia 30%, control 35%. Úsalo como hipótesis para el comité, no como veredicto.
          </p>
        </div>
      }
    />
  );
}
