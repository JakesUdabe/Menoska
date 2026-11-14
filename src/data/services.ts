export const serviceIds = [
  "growth",
  "treasury",
  "capital",
  "tax",
  "revenue",
  "funding",
] as const;

export type ServiceId = (typeof serviceIds)[number];

export type ServiceDefinition = {
  id: ServiceId;
  slug: string;
  image: string;
};

export const serviceCatalog: ServiceDefinition[] = [
  { id: "growth", slug: "arquitectura-de-crecimiento", image: "/images/modelo.jpg" },
  { id: "treasury", slug: "tesoreria", image: "/images/tesoreria.jpg" },
  { id: "capital", slug: "capital-y-ma", image: "/images/capital.svg" },
  { id: "tax", slug: "fiscalidad-y-riesgo", image: "/images/fiscalidad.svg" },
  { id: "revenue", slug: "ingresos", image: "/images/ingresos.svg" },
  { id: "funding", slug: "financiacion-no-dilutiva", image: "/images/financiacion.svg" },
];

export function serviceBySlug(slug: string) {
  return serviceCatalog.find((service) => service.slug === slug);
}
