"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useT } from "@/i18n/provider";
import { Field, NumberInput, ResultStat, ToolWorkspace } from "@/components/modules/tool-workspace";
import { usePersistedWorksheet } from "@/lib/hooks/use-persisted-worksheet";

type State = { equity: number; debt: number; newRaise: number; preMoney: number; interest: number };

export default function EstructuraCapitalPage() {
  const t = useT();
  const [state, setState] = usePersistedWorksheet<State>("estructura-capital", {
    equity: 8_000_000,
    debt: 3_500_000,
    newRaise: 4_000_000,
    preMoney: 20_000_000,
    interest: 6.5,
  });
  const { equity, debt, newRaise, preMoney, interest } = state;

  const { postMoney, dilution, debtShare, chart, interestCost } = useMemo(() => {
    const postMoney = preMoney + newRaise;
    const dilution = postMoney > 0 ? (newRaise / postMoney) * 100 : 0;
    const total = equity + debt + newRaise;
    const debtShare = total > 0 ? (debt / total) * 100 : 0;
    return {
      postMoney,
      dilution,
      debtShare,
      interestCost: debt * (interest / 100),
      chart: [
        { name: "Equity actual", value: equity, color: "#00895B" },
        { name: "Nueva ronda", value: newRaise, color: "#1fb37a" },
        { name: "Deuda", value: debt, color: "#394A51" },
      ],
    };
  }, [equity, debt, newRaise, preMoney, interest]);

  return (
    <ToolWorkspace
      badge={t("sidebar.finanzas")}
      title={t("tools.estructuraCapital")}
      description={t("tools.estructuraCapitalLead")}
      exportLabel={t("tools.exportJson")}
      exportData={{ equity, debt, newRaise, preMoney, interest, postMoney, dilution, debtShare, interestCost, chart }}
      inputs={
        <div className="space-y-4">
          <Field label="Equity actual">
            <NumberInput value={equity} onChange={(equity) => setState((s) => ({ ...s, equity }))} min={0} step={100000} suffix="€" />
          </Field>
          <Field label="Deuda">
            <NumberInput value={debt} onChange={(debt) => setState((s) => ({ ...s, debt }))} min={0} step={100000} suffix="€" />
          </Field>
          <Field label="Nueva ronda">
            <NumberInput value={newRaise} onChange={(newRaise) => setState((s) => ({ ...s, newRaise }))} min={0} step={100000} suffix="€" />
          </Field>
          <Field label="Pre-money">
            <NumberInput value={preMoney} onChange={(preMoney) => setState((s) => ({ ...s, preMoney }))} min={0} step={100000} suffix="€" />
          </Field>
          <Field label="Interés deuda">
            <NumberInput value={interest} onChange={(interest) => setState((s) => ({ ...s, interest }))} min={0} max={25} step={0.1} suffix="%" />
          </Field>
        </div>
      }
      results={
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat label="Post-money" value={`${(postMoney / 1e6).toFixed(1)} M€`} />
            <ResultStat label="Dilución" value={`${dilution.toFixed(1)}%`} accent />
            <ResultStat label="% deuda" value={`${debtShare.toFixed(1)}%`} />
          </div>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chart} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                  {chart.map((c) => (
                    <Cell key={c.name} fill={c.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `${(v / 1e6).toFixed(2)} M€`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="text-sm text-muted-foreground">
            Coste anual estimado de la deuda: {(interestCost / 1000).toFixed(0)} K€. Simulación orientativa para escenarios de financiación.
          </p>
        </div>
      }
    />
  );
}
