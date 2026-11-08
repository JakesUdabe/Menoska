"use client";

import type { ReactNode } from "react";
import { Download, Printer } from "lucide-react";
import { cn } from "@/lib/utils";

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".json") ? filename : `${filename}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ToolWorkspace({
  title,
  description,
  badge,
  inputs,
  results,
  className,
  exportData,
  exportLabel,
}: {
  title: string;
  description: string;
  badge?: string;
  inputs: ReactNode;
  results: ReactNode;
  className?: string;
  /** When set, shows a JSON download control with this payload. */
  exportData?: unknown;
  exportLabel?: string;
}) {
  return (
    <div className={cn("space-y-8", className)}>
      <header className="flex max-w-3xl flex-wrap items-start justify-between gap-3">
        <div>
          {badge ? (
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-primary">{badge}</p>
          ) : null}
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink">{title}</h1>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">{description}</p>
        </div>
        {exportData !== undefined ? (
          <div className="no-print flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
              onClick={() => window.print()}
            >
              <Printer className="size-3.5" />
              Imprimir / PDF
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
              onClick={() => downloadJson(title.replace(/\s+/g, "-").toLowerCase() || "export", exportData)}
            >
              <Download className="size-3.5" />
              {exportLabel ?? "Exportar JSON"}
            </button>
          </div>
        ) : null}
      </header>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <section className="no-print rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">{inputs}</section>
        <section className="print-report rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">{results}</section>
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="relative">
      <input
        type="number"
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step ?? 1}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {suffix ? (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-[11px] text-muted-foreground">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function ResultStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-display text-2xl font-semibold tracking-tight", accent ? "text-primary" : "text-ink")}>
        {value}
      </p>
    </div>
  );
}
