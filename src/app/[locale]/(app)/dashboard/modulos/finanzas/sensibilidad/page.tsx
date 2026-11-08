"use client";

import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useT } from "@/i18n/provider";
import { Field, NumberInput, ResultStat, ToolWorkspace } from "@/components/modules/tool-workspace";
import { usePersistedWorksheet } from "@/lib/hooks/use-persisted-worksheet";

type State = { baseNpv: number; priceShock: number; volumeShock: number; costShock: number; range: number };

export default function SensibilidadPage() {
  const t = useT();
  const [state, setState] = usePersistedWorksheet<State>("sensibilidad", {
    baseNpv: 4_800_000,
    priceShock: 0,
    volumeShock: 0,
    costShock: 0,
    range: 20,
  });
  const { baseNpv, priceShock, volumeShock, costShock, range } = state;

  const { npv, series, tornado } = useMemo(() => {
    const priceFactor = 1 + priceShock / 100;
    const volumeFactor = 1 + volumeShock / 100;
    const costFactor = 1 + costShock / 100;
    const npv = baseNpv * priceFactor * volumeFactor * (2 - costFactor);

    const series = [];
    for (let s = -range; s <= range; s += 5) {
      series.push({
        shock: `${s > 0 ? "+" : ""}${s}%`,
        precio: Math.round((baseNpv * (1 + s / 100)) / 1000) / 1000,
        volumen: Math.round((baseNpv * (1 + s / 100)) / 1000) / 1000,
        coste: Math.round((baseNpv * (2 - (1 + s / 100))) / 1000) / 1000,
      });
    }

    const tornado = [
      { name: "Precio", delta: Math.abs(baseNpv * (range / 100)) },
      { name: "Volumen", delta: Math.abs(baseNpv * (range / 100) * 0.85) },
      { name: "Coste", delta: Math.abs(baseNpv * (range / 100) * 0.7) },
    ].sort((a, b) => b.delta - a.delta);

    return { npv, series, tornado };
  }, [baseNpv, priceShock, volumeShock, costShock, range]);

  return (
    <ToolWorkspace
      badge={t("sidebar.finanzas")}
      title={t("tools.sensibilidad")}
      description={t("tools.sensibilidadLead")}
      exportLabel={t("tools.exportJson")}
      exportData={{ baseNpv, priceShock, volumeShock, costShock, range, npv, series, tornado }}
      inputs={
        <div className="space-y-4">
          <Field label="NPV base">
            <NumberInput value={baseNpv} onChange={(baseNpv) => setState((s) => ({ ...s, baseNpv }))} min={0} step={100000} suffix="€" />
          </Field>
          <Field label="Shock precio">
            <NumberInput value={priceShock} onChange={(priceShock) => setState((s) => ({ ...s, priceShock }))} min={-50} max={50} suffix="%" />
          </Field>
          <Field label="Shock volumen">
            <NumberInput value={volumeShock} onChange={(volumeShock) => setState((s) => ({ ...s, volumeShock }))} min={-50} max={50} suffix="%" />
          </Field>
          <Field label="Shock coste">
            <NumberInput value={costShock} onChange={(costShock) => setState((s) => ({ ...s, costShock }))} min={-50} max={50} suffix="%" />
          </Field>
          <Field label="Rango tornado">
            <NumberInput value={range} onChange={(range) => setState((s) => ({ ...s, range }))} min={5} max={40} suffix="±%" />
          </Field>
        </div>
      }
      results={
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat label="NPV base" value={`${(baseNpv / 1e6).toFixed(2)} M€`} />
            <ResultStat label="NPV estresado" value={`${(npv / 1e6).toFixed(2)} M€`} accent />
            <ResultStat label="Δ vs base" value={`${(((npv - baseNpv) / baseNpv) * 100).toFixed(1)}%`} />
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d5deda" />
                <XAxis dataKey="shock" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => `${v}M`} />
                <Tooltip formatter={(v: number) => `${v} M€`} />
                <Line type="monotone" dataKey="precio" stroke="#00895B" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="coste" stroke="#394A51" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-2">
            {tornado.map((item) => (
              <li key={item.name} className="flex items-center gap-3 text-sm">
                <span className="w-20 font-medium">{item.name}</span>
                <div className="h-2 flex-1 rounded-full bg-secondary">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${(item.delta / tornado[0].delta) * 100}%` }} />
                </div>
                <span className="font-mono text-xs text-muted-foreground">±{(item.delta / 1000).toFixed(0)} K€</span>
              </li>
            ))}
          </ul>
        </div>
      }
    />
  );
}
