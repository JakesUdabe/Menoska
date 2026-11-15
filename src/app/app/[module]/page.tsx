import { serviceCatalog } from "@/data/services";
import { ModuleScreen } from "@/components/module-screen";

export function generateStaticParams() {
  return serviceCatalog.map((service) => ({ module: service.slug }));
}

export default async function ModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  return <ModuleScreen module={module} kind="kpi" />;
}
