import { serviceCatalog } from "@/data/services";
import { ModuleScreen } from "@/components/module-screen";

export function generateStaticParams() {
  return serviceCatalog.map((service) => ({ module: service.slug }));
}

export default async function ReportPage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  return <ModuleScreen module={module} kind="report" />;
}
