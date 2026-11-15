"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { ModuleBoard } from "@/components/module-board";
import { listEntries, workspaceContext } from "@/lib/session";
import { moduleBySlug, type ModuleEntry } from "@/lib/workspace";

export function ModuleScreen({ module, kind }: { module: string; kind: "kpi" | "report" }) {
  const current = moduleBySlug(module);
  const [entries, setEntries] = useState<ModuleEntry[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [hasClient, setHasClient] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    (async () => {
      const context = await workspaceContext();
      const nextEntries = context?.clientId ? await listEntries(context.clientId, current.id, kind) : [];
      if (cancelled) return;
      setEntries(nextEntries);
      setCanEdit(Boolean(context?.canEdit));
      setHasClient(Boolean(context?.clientId));
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [current, kind]);

  if (!current) notFound();
  if (!ready) return <p className="wrap">Cargando…</p>;
  return (
    <ModuleBoard
      slug={current.slug}
      moduleId={current.id}
      name={current.name}
      kind={kind}
      entries={entries}
      canEdit={canEdit}
      hasClient={hasClient}
    />
  );
}
