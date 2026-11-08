import { SHOWCASE_PATENTS } from "@/lib/showcase-case";
import type { PatentHit } from "@/lib/patents/lens";
import type { CommercialAct, TechnicalRdf } from "./rdf";

/**
 * Functional stand-ins used only when the register does not return claim text.
 * They are not the official wording of the patent.
 */
const SCREENING_CLAIMS: Record<string, string[]> = {
  US8268469B2: [
    "1. A battery pack comprising: an enclosure housing a plurality of lithium-ion cells; a gas exhaust path that vents gas to the exterior during thermal runaway; a passive opening element that yields when pressure exceeds a threshold.",
  ],
  US8277965B2: [
    "1. A battery pack enclosure comprising: a housing for a plurality of cells; a release path that directs vent gas out of the enclosure during thermal runaway; a passive panel that opens under pressure.",
  ],
  US9093726B2: [
    "1. A battery pack comprising: a plurality of electrochemical cells; an active system that injects suppressant fluid when thermal runaway is detected; a controller that opens a motorized valve.",
  ],
  US8082743B2: [
    "1. A control system comprising: a sensor that measures battery pack temperature; a controller that optimizes operating temperature of the cells during driving.",
  ],
};

export function showcaseRdf(): TechnicalRdf {
  const commercialActs: CommercialAct[] = ["fabricar", "vender", "importar"];
  return {
    productName: "Módulo de venteo pasivo para pack de batería",
    commercialActs,
    commercialDetail:
      "Fabricar el módulo en planta europea, vender el pack completo a fabricantes de vehículos e importar el recinto ya mecanizado para ensamblarlo con las celdas.",
    jurisdictions: "EP, ES, DE, US",
    cutoff: "2024-06-01",
    technicalProblem:
      "El pack de batería de ion-litio puede liberar gas caliente y partículas cuando una celda entra en thermal runaway. Si ese gas queda confinado, la presión deforma el recinto y el chorro puede alcanzar el habitáculo o la celda vecina. Hace falta un camino de escape que se abra solo por presión y dirija el efluente fuera del pack antes de que el recinto ceda. No usa bomba ni una señal de control para abrir el venteo.",
    technicalEffect:
      "El gas de venteo sale por un conducto dedicado hacia el exterior del pack. La presión interior se alivia cuando el disco cede y el chorro no queda libre dentro del recinto ni se dirige al habitáculo.",
    embodiment:
      "El módulo agrupa celdas prismáticas de ion-litio dentro de un recinto de aluminio cerrado en operación normal. Un colector común comunica la zona de venteo de cada celda con un conducto de escape de gas. En ese conducto hay un disco de ruptura pasivo que permanece cerrado mientras la presión es la de servicio y cede solo cuando la presión interna supera el umbral. El conducto termina fuera del pack, orientado lejos del habitáculo, de modo que el efluente sale al exterior. No hay bomba. No hay inyección de agente extintor. No hay válvula motorizada. La apertura del disco no depende de una orden externa: el camino de escape es pasivo de principio a fin.",
    essentialFeatures: [
      "Recinto que aloja una pluralidad de celdas de ion-litio dentro del pack de batería",
      "Colector que comunica el volumen de venteo de cada celda con un conducto de escape de gas",
      "Elemento de apertura pasiva que cede al superar una presión de umbral durante el thermal runaway",
      "Conducto que dirige el gas hacia el exterior del pack y lejos del habitáculo",
      "Ausencia de inyección activa de agente extintor dentro del conducto",
      "Sin control del BMS sobre la apertura del venteo",
    ].join("\n"),
    materialsParameters:
      "Celdas prismáticas NMC dentro de un recinto de aluminio. Disco de ruptura pasivo calibrado entre 150 y 300 kPa. Conducto de aluminio para el gas de escape. La apertura depende solo de la presión del gas en el pack.",
    exclusions:
      "Queda fuera la mitigación activa por inyección de fluido, la bomba, la válvula motorizada abierta por el BMS y cualquier sistema cuyo fin sea optimizar la temperatura de operación en conducción normal. Tampoco es una placa de refrigeración líquida.",
    variants:
      "El disco puede sustituirse por una tapa abatible con muelle. El conducto puede salir por el suelo del pack o por un lateral. El número de celdas por módulo varía entre 8 y 24 sin cambiar el camino de escape.",
    vocabulary:
      "thermal runaway, venteo, gas exhaust, battery pack enclosure, escape de gases, pasivo, H01M, pack de batería",
    ipc: "H01M",
    knownPatents: "US8268469B2, US8277965B2, US9093726B2, US8082743B2",
  };
}

export function demoPatentHits(): PatentHit[] {
  return SHOWCASE_PATENTS.map((patent) => ({
    id: patent.id,
    title: patent.title,
    abstract: patent.body,
    url: patent.url,
    applicants: [patent.assignee],
    ipc: [patent.ipc],
    publishedAt: patent.publishedAt,
    claims: SCREENING_CLAIMS[patent.id] ?? [],
  }));
}

export function screeningClaimsFor(id: string): string[] {
  return SCREENING_CLAIMS[id] ?? [];
}
