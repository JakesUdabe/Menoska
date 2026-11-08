"use client";

import { useMemo } from "react";
import { useT } from "@/i18n/provider";
import { Field, NumberInput, ResultStat, TextInput, ToolWorkspace } from "@/components/modules/tool-workspace";
import { usePersistedWorksheet } from "@/lib/hooks/use-persisted-worksheet";

type Row = { name: string; exposure: number; pd: number; lgd: number };
type State = { portfolioName: string; rows: Row[] };

const SEED: Row[] = [
  { name: "Cliente A (AAA-)", exposure: 1_200_000, pd: 0.8, lgd: 35 },
  { name: "Cliente B (BBB)", exposure: 800_000, pd: 2.4, lgd: 45 },
  { name: "Cliente C (BB)", exposure: 450_000, pd: 5.1, lgd: 55 },
  { name: "Cliente D (B)", exposure: 220_000, pd: 9.5, lgd: 60 },
];

function riskBand(el: number) {
  if (el < 15_000) return { label: "Bajo", className: "bg-primary/15 text-primary" };
  if (el < 40_000) return { label: "Medio", className: "bg-amber-500/15 text-amber-700" };
  return { label: "Alto", className: "bg-destructive/15 text-destructive" };
}

export default function RiesgoCreditoPage() {
  const t = useT();
  const [state, setState] = usePersistedWorksheet<State>("riesgo-credito", {
    portfolioName: "Cartera innovación B2B",
    rows: SEED,
  });
  const { portfolioName, rows } = state;

  const { expectedLoss, maxEl, ranked } = useMemo(() => {
    const ranked = rows
      .map((r) => ({ ...r, el: r.exposure * (r.pd / 100) * (r.lgd / 100) }))
      .sort((a, b) => b.el - a.el);
    return {
      ranked,
      expectedLoss: ranked.reduce((s, r) => s + r.el, 0),
      maxEl: ranked[0]?.el ?? 0,
    };
  }, [rows]);

  function update(i: number, key: keyof Row, value: string | number) {
    setState((prev) => ({
      ...prev,
      rows: prev.rows.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)),
    }));
  }

  return (
    <ToolWorkspace
      badge={t("sidebar.finanzas")}
      title={t("tools.riesgoCredito")}
      description={t("tools.riesgoCreditoLead")}
      exportLabel={t("tools.exportJson")}
      exportData={{ portfolioName, rows, expectedLoss, maxEl, ranked }}
      inputs={
        <div className="space-y-4">
          <Field label="Cartera">
            <TextInput value={portfolioName} onChange={(portfolioName) => setState((s) => ({ ...s, portfolioName }))} />
          </Field>
          <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
            {rows.map((r, i) => (
              <div key={i} className="space-y-2 rounded-lg border p-3">
                <Field label="Contraparte">
                  <TextInput value={r.name} onChange={(v) => update(i, "name", v)} />
                </Field>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Exposición">
                    <NumberInput value={r.exposure} onChange={(v) => update(i, "exposure", v)} min={0} step={10000} />
                  </Field>
                  <Field label="PD %">
                    <NumberInput value={r.pd} onChange={(v) => update(i, "pd", v)} min={0} max={100} step={0.1} />
                  </Field>
                  <Field label="LGD %">
                    <NumberInput value={r.lgd} onChange={(v) => update(i, "lgd", v)} min={0} max={100} />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        </div>
      }
      results={
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat label="Cartera" value={portfolioName.slice(0, 14)} />
            <ResultStat label="EL total" value={`${(expectedLoss / 1000).toFixed(0)} K€`} accent />
            <ResultStat label="EL máx." value={`${(maxEl / 1000).toFixed(0)} K€`} />
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[440px] text-left text-sm">
              <thead className="bg-secondary/50 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Contraparte</th>
                  <th className="px-3 py-2">EL</th>
                  <th className="px-3 py-2">Banda</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ranked.map((r) => {
                  const band = riskBand(r.el);
                  return (
                    <tr key={r.name}>
                      <td className="px-3 py-2.5 font-medium">{r.name}</td>
                      <td className="px-3 py-2.5">{`${(r.el / 1000).toFixed(1)} K€`}</td>
                      <td className="px-3 py-2.5">
                        <span className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase ${band.className}`}>{band.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted-foreground">EL = Exposición × PD × LGD. Matriz demo para priorizar seguimiento de crédito.</p>
        </div>
      }
    />
  );
}
