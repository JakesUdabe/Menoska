"use client";

import { useMemo } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useT } from "@/i18n/provider";
import { Field, NumberInput, ResultStat, ToolWorkspace } from "@/components/modules/tool-workspace";
import { usePersistedWorksheet } from "@/lib/hooks/use-persisted-worksheet";

function fmtM(n: number) {
  return `${(n / 1e6).toFixed(2)} M€`;
}

type State = { revenueY1: number; growth: number; margin: number; opex: number; years: number };

export default function ModelosFinancierosPage() {
  const t = useT();
  const [state, setState] = usePersistedWorksheet<State>("modelos", {
    revenueY1: 2_400_000,
    growth: 45,
    margin: 28,
    opex: 1_100_000,
    years: 5,
  });
  const { revenueY1, growth, margin, opex, years } = state;

  const { series, npv, ebitdaY5 } = useMemo(() => {
    const rows = [];
    let rev = revenueY1;
    let npv = 0;
    const discount = 0.1;
    for (let y = 1; y <= years; y++) {
      const ebitda = rev * (margin / 100) - opex * Math.pow(1.05, y - 1);
      npv += ebitda / Math.pow(1 + discount, y);
      rows.push({ year: `A${y}`, ingresos: Math.round(rev / 1000) / 1000, ebitda: Math.round(ebitda / 1000) / 1000 });
      rev *= 1 + growth / 100;
    }
    return { series: rows, npv, ebitdaY5: (rows[rows.length - 1]?.ebitda ?? 0) * 1e6 };
  }, [revenueY1, growth, margin, opex, years]);

  return (
    <ToolWorkspace
      badge={t("sidebar.finanzas")}
      title={t("tools.modelosFinancieros")}
      description={t("tools.modelosFinancierosLead")}
      exportLabel={t("tools.exportJson")}
      exportData={{ revenueY1, growth, margin, opex, years, series, npv, ebitdaY5 }}
      inputs={
        <div className="space-y-4">
          <Field label="Ingresos año 1">
            <NumberInput value={revenueY1} onChange={(revenueY1) => setState((s) => ({ ...s, revenueY1 }))} min={0} step={100000} suffix="€" />
          </Field>
          <Field label="Crecimiento anual">
            <NumberInput value={growth} onChange={(growth) => setState((s) => ({ ...s, growth }))} min={-20} max={200} suffix="%" />
          </Field>
          <Field label="Margen bruto">
            <NumberInput value={margin} onChange={(margin) => setState((s) => ({ ...s, margin }))} min={0} max={90} suffix="%" />
          </Field>
          <Field label="OPEX base">
            <NumberInput value={opex} onChange={(opex) => setState((s) => ({ ...s, opex }))} min={0} step={50000} suffix="€" />
          </Field>
          <Field label="Horizonte">
            <NumberInput value={years} onChange={(years) => setState((s) => ({ ...s, years }))} min={3} max={10} suffix="años" />
          </Field>
        </div>
      }
      results={
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat label="Ingresos A1" value={fmtM(revenueY1)} />
            <ResultStat label="EBITDA final" value={fmtM(ebitdaY5)} />
            <ResultStat label="NPV (10%)" value={fmtM(npv)} accent />
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d5deda" />
                <XAxis dataKey="year" />
                <YAxis tickFormatter={(v) => `${v}M`} />
                <Tooltip formatter={(v: number) => `${v} M€`} />
                <Legend />
                <Line type="monotone" dataKey="ingresos" stroke="#394A51" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="ebitda" stroke="#00895B" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      }
    />
  );
}
