"use client";

import { useMemo, useState } from "react";
import { useT } from "@/i18n/provider";
import { Field, NumberInput, ResultStat, TextInput, ToolWorkspace } from "@/components/modules/tool-workspace";
import { usePersistedWorksheet } from "@/lib/hooks/use-persisted-worksheet";

type Account = { name: string; potential: number; access: number; urgency: number };

const DEFAULTS: Account[] = [
  { name: "Iberdrola Innovación", potential: 9, access: 6, urgency: 8 },
  { name: "Siemens Energy ES", potential: 8, access: 4, urgency: 7 },
  { name: "Repsol Tech Lab", potential: 7, access: 8, urgency: 6 },
  { name: "Acciona Energy", potential: 8, access: 5, urgency: 5 },
];

export default function AccountMappingPage() {
  const t = useT();
  const [accounts, setAccounts] = usePersistedWorksheet<Account[]>("account-mapping", DEFAULTS);
  const [newName, setNewName] = useState("");

  const ranked = useMemo(
    () =>
      [...accounts]
        .map((a) => ({ ...a, score: a.potential * 0.4 + a.access * 0.35 + a.urgency * 0.25 }))
        .sort((a, b) => b.score - a.score),
    [accounts],
  );

  function update(i: number, key: keyof Account, value: string | number) {
    setAccounts((prev) => prev.map((a, idx) => (idx === i ? { ...a, [key]: value } : a)));
  }

  return (
    <ToolWorkspace
      badge={t("sidebar.estrategia")}
      title={t("tools.accountMapping")}
      description={t("tools.accountMappingLead")}
      exportLabel={t("tools.exportJson")}
      exportData={{ accounts, ranked }}
      inputs={
        <div className="space-y-4">
          <div className="flex gap-2">
            <TextInput value={newName} onChange={setNewName} placeholder="Nueva cuenta" />
            <button
              type="button"
              className="shrink-0 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
              onClick={() => {
                if (!newName.trim()) return;
                setAccounts((p) => [...p, { name: newName.trim(), potential: 5, access: 5, urgency: 5 }]);
                setNewName("");
              }}
            >
              Añadir
            </button>
          </div>
          <div className="max-h-[420px] space-y-4 overflow-y-auto pr-1">
            {accounts.map((a, i) => (
              <div key={`${a.name}-${i}`} className="space-y-2 rounded-lg border border-border p-3">
                <Field label="Cuenta">
                  <TextInput value={a.name} onChange={(v) => update(i, "name", v)} />
                </Field>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Potencial">
                    <NumberInput value={a.potential} onChange={(v) => update(i, "potential", v)} min={1} max={10} />
                  </Field>
                  <Field label="Acceso">
                    <NumberInput value={a.access} onChange={(v) => update(i, "access", v)} min={1} max={10} />
                  </Field>
                  <Field label="Urgencia">
                    <NumberInput value={a.urgency} onChange={(v) => update(i, "urgency", v)} min={1} max={10} />
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
            <ResultStat label="Cuentas" value={String(accounts.length)} />
            <ResultStat label="Top account" value={ranked[0]?.name.slice(0, 16) ?? "—"} accent />
            <ResultStat label="Score top" value={ranked[0] ? ranked[0].score.toFixed(1) : "—"} />
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="bg-secondary/50 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Cuenta</th>
                  <th className="px-3 py-2">Score</th>
                  <th className="px-3 py-2">Cuadrante</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ranked.map((a, i) => {
                  const quadrant = a.potential >= 7 && a.access >= 6 ? "Prioridad" : a.potential >= 7 ? "Cultivar" : "Selectivo";
                  return (
                    <tr key={a.name}>
                      <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2.5 font-medium">{a.name}</td>
                      <td className="px-3 py-2.5 text-primary">{a.score.toFixed(1)}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{quadrant}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      }
    />
  );
}
