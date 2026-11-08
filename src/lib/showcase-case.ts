/**
 * Un solo caso de demostración, con documentos públicos.
 * Las cifras de mercado son de planificación para el informe, no un estudio de terceros.
 */

export const SHOWCASE_PROJECT_ID = "project-thermal";
export const SHOWCASE_BULLETIN_ID = "b1";
export const SHOWCASE_SOTA_ID = "rep-thermal-sota";
export const SHOWCASE_MARKET_ID = "rep-thermal-market";

export type ShowcaseRisk = "Bajo" | "Medio" | "Alto";

export type ShowcasePatent = {
  id: string;
  title: string;
  assignee: string;
  year: number;
  risk: ShowcaseRisk;
  url: string;
  /** Texto que debe contener empresa + tecnología para el filtro AND del boletín. */
  body: string;
  ipc: string;
  publishedAt: string;
};

export const SHOWCASE_PATENTS: ShowcasePatent[] = [
  {
    id: "US8268469B2",
    title: "Battery pack gas exhaust system",
    assignee: "Tesla",
    year: 2012,
    risk: "Alto",
    url: "https://patents.google.com/patent/US8268469B2/en",
    body: "Tesla patent. Thermal management enclosure that vents gas when battery cells enter thermal runaway.",
    ipc: "H01M",
    publishedAt: "2012-09-18",
  },
  {
    id: "US8277965B2",
    title: "Battery pack enclosure with controlled thermal runaway release",
    assignee: "Tesla",
    year: 2012,
    risk: "Alto",
    url: "https://patents.google.com/patent/US8277965B2/en",
    body: "Tesla patent. Battery pack enclosure that controls release during thermal runaway.",
    ipc: "H01M",
    publishedAt: "2012-10-02",
  },
  {
    id: "US9093726B2",
    title: "Active thermal runaway mitigation system for use within a battery pack",
    assignee: "Tesla",
    year: 2015,
    risk: "Alto",
    url: "https://patents.google.com/patent/US9093726B2/en",
    body: "Tesla patent. Active thermal runaway mitigation inside a battery pack.",
    ipc: "H01M",
    publishedAt: "2015-07-28",
  },
  {
    id: "US8082743B2",
    title: "Battery pack temperature optimization control system",
    assignee: "Tesla",
    year: 2011,
    risk: "Medio",
    url: "https://patents.google.com/patent/US8082743B2/en",
    body: "Tesla patent. Control system that optimizes battery pack temperature.",
    ipc: "H01M",
    publishedAt: "2011-12-20",
  },
];

export const SHOWCASE_CASE = {
  projectName: "Gestión térmica de packs de batería",
  projectDescription:
    "Caso público. Familia de patentes de Tesla sobre escape y mitigación de thermal runaway, seguida hasta el informe.",
  company: "Tesla",
  sector: "Gestión térmica de baterías para vehículo eléctrico",
  ticketEur: 2_400_000,
  tamEur: 4_200_000_000,
  geoShare: 35,
  segmentShare: 40,
  captureShare: 8,
  fit: "partner" as const,
  priceShockPct: 15,
  targetRevenueEur: 6_000_000,
  variableCostRatio: 0.62,
  fixedCostEur: 1_200_000,
  thesis:
    "La familia pública de Tesla (US8268469B2, US8277965B2, US9093726B2) cubre el recinto y la mitigación activa del thermal runaway. El hueco defendible no es copiar ese escape: es el control de temperatura (US8082743B2 marca el terreno) vía licencia o desarrollo conjunto.",
  risks:
    "Las reivindicaciones de escape y mitigación activa dejan poco margen para un build literal. Esto no es una opinión legal. Las cifras de mercado del informe son una ilustración de planificación, no un estudio encargado.",
};

export function showcaseSam(input: { tamEur: number; geoShare: number; segmentShare: number }) {
  return input.tamEur * (input.geoShare / 100) * (input.segmentShare / 100);
}

export function showcaseSom(input: { tamEur: number; geoShare: number; segmentShare: number; captureShare: number }) {
  return showcaseSam(input) * (input.captureShare / 100);
}

/** Resultado ilustrativo tras un shock de precio. Coste variable escala con el ingreso; el fijo no. */
export function showcaseProfitAfterShock(shockPct: number) {
  const revenue = SHOWCASE_CASE.targetRevenueEur * (1 - shockPct / 100);
  const contribution = revenue * (1 - SHOWCASE_CASE.variableCostRatio);
  return contribution - SHOWCASE_CASE.fixedCostEur;
}

export function formatEur(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}
