import { serviceCatalog, type ServiceId } from "@/data/services";
import { es } from "@/i18n/es";

export type Profile = {
  id: string;
  role: "admin" | "client" | "empleado";
  first_name: string;
  last_name: string;
  nif: string | null;
  email: string;
};

export type ModuleEntry = {
  id: string;
  client_id: string;
  module: ServiceId;
  kind: "kpi" | "report";
  title: string;
  body: string;
  value: string;
  unit: string;
  sort_order: number;
};

export const modules = serviceCatalog.map((service) => ({
  id: service.id,
  slug: service.slug,
  name: es.services[service.id].menu,
}));

export function moduleBySlug(slug: string) {
  return modules.find((item) => item.slug === slug);
}
