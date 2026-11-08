"use client";



import { useMemo } from "react";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { useT } from "@/i18n/provider";

import { Field, NumberInput, ResultStat, ToolWorkspace } from "@/components/modules/tool-workspace";

import { usePersistedWorksheet } from "@/lib/hooks/use-persisted-worksheet";



function fmt(n: number) {

  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} B€`;

  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} M€`;

  if (n >= 1e3) return `${(n / 1e3).toFixed(0)} K€`;

  return `${Math.round(n)} €`;

}



type State = { tam: number; geoShare: number; segmentShare: number; capture: number };



export default function TamSamSomPage() {

  const t = useT();

  const [state, setState] = usePersistedWorksheet<State>("tam-sam-som", {

    tam: 12_000_000_000,

    geoShare: 35,

    segmentShare: 40,

    capture: 8,

  });

  const { tam, geoShare, segmentShare, capture } = state;



  const { sam, som, chart } = useMemo(() => {

    const sam = tam * (geoShare / 100) * (segmentShare / 100);

    const som = sam * (capture / 100);

    return {

      sam,

      som,

      chart: [

        { name: "TAM resto", value: Math.max(tam - sam, 0), color: "#394A51" },

        { name: "SAM resto", value: Math.max(sam - som, 0), color: "#5a7a6e" },

        { name: "SOM", value: som, color: "#00895B" },

      ],

    };

  }, [tam, geoShare, segmentShare, capture]);



  return (

    <ToolWorkspace

      badge={t("sidebar.estrategia")}

      title={t("tools.tamSamSom")}

      description={t("tools.tamSamSomLead")}

      exportLabel={t("tools.exportJson")}

      exportData={{ tam, geoShare, segmentShare, capture, sam, som }}

      inputs={

        <div className="space-y-4">

          <Field label="TAM (mercado total)">

            <NumberInput value={tam} onChange={(tam) => setState((s) => ({ ...s, tam }))} min={0} step={1000000} suffix="€" />

          </Field>

          <Field label="% geografía reachable">

            <NumberInput value={geoShare} onChange={(geoShare) => setState((s) => ({ ...s, geoShare }))} min={0} max={100} suffix="%" />

          </Field>

          <Field label="% segmento servible">

            <NumberInput

              value={segmentShare}

              onChange={(segmentShare) => setState((s) => ({ ...s, segmentShare }))}

              min={0}

              max={100}

              suffix="%"

            />

          </Field>

          <Field label="% captura SOM (3–5 años)">

            <NumberInput value={capture} onChange={(capture) => setState((s) => ({ ...s, capture }))} min={0} max={100} suffix="%" />

          </Field>

        </div>

      }

      results={

        <div className="space-y-4">

          <div className="grid gap-3 sm:grid-cols-3">

            <ResultStat label="TAM" value={fmt(tam)} />

            <ResultStat label="SAM" value={fmt(sam)} />

            <ResultStat label="SOM" value={fmt(som)} accent />

          </div>

          <div className="h-56 w-full">

            <ResponsiveContainer width="100%" height="100%">

              <PieChart>

                <Pie data={chart} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>

                  {chart.map((c) => (

                    <Cell key={c.name} fill={c.color} />

                  ))}

                </Pie>

                <Tooltip formatter={(v: number) => fmt(v)} />

              </PieChart>

            </ResponsiveContainer>

          </div>

          <p className="text-sm text-muted-foreground">

            SAM = TAM × geografía × segmento. SOM = SAM × captura esperada. Ajusta supuestos para el comité.

          </p>

        </div>

      }

    />

  );

}


