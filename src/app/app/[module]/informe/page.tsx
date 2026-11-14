import { notFound } from "next/navigation";
import { ModuleBoard } from "@/components/module-board";
import { listEntries, moduleBySlug, workspaceContext } from "@/lib/workspace";

export default async function ReportPage({ params }: { params: Promise<{ module: string }> }) {
  const { module: slug } = await params;
  const current = moduleBySlug(slug);
  if (!current) notFound();
  const { clientId, canEdit } = await workspaceContext();
  const entries = clientId ? await listEntries(clientId, current.id, "report") : [];
  return (
    <ModuleBoard
      slug={current.slug}
      moduleId={current.id}
      name={current.name}
      kind="report"
      entries={entries}
      canEdit={canEdit}
      hasClient={Boolean(clientId)}
    />
  );
}
