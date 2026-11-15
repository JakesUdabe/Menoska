import { ServiceView } from "@/components/service-view";
import { serviceCatalog } from "@/data/services";

export function generateStaticParams() {
  return serviceCatalog.map((service) => ({ slug: service.slug }));
}

export default function ServicePage() {
  return <ServiceView />;
}
