import { notFound } from "next/navigation";
import { ModuleBoard } from "@/components/module-board";
import { listEntries, moduleBySlug, workspaceContext } from "@/lib/workspace";

export default async function ModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module: slug } = await params;
  const current = moduleBySlug(slug);
  if (!current) notFound();
  const { clientId, canEdit } = await workspaceContext();
  const entries = clientId ? await listEntries(clientId, current.id, "kpi") : [];
  return (
    <ModuleBoard
      slug={current.slug}
      moduleId={current.id}
      name={current.name}
      kind="kpi"
      entries={entries}
      canEdit={canEdit}
      hasClient={Boolean(clientId)}
    />
  );
}
