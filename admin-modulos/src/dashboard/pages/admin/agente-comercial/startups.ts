import type { SalesStartup } from "./types";

export type CommercialSender = {
  userId: string;
  fullName: string;
  jobTitle: string;
  workEmail: string;
};

const DOMAIN = "proposalyze.com";
const TONE =
  "Directo, breve y concreto. Sin hype ni plantillas. Ancla el mensaje en el punto de dolor real de la empresa (ritmo de convocatorias/memorias que se intuye por su actividad reciente) y en cómo Proposalyze lo resuelve.";
const VALUE_PROPOSITION =
  "Aliviar la carga de matching de convocatorias, redacción de memorias técnicas y revisión previa a presentación, para que el equipo gane capacidad y se centre en estrategia y cierre.";

export function buildStartupFromSender(sender: CommercialSender): SalesStartup {
  const job = sender.jobTitle.trim() || "Equipo comercial";
  const email = sender.workEmail.trim().toLowerCase();
  return {
    id: "proposalyze",
    name: "Proposalyze",
    domain: DOMAIN,
    fromName: sender.fullName.trim() || "Proposalyze",
    fromEmail: email,
    tone: TONE,
    valueProposition: VALUE_PROPOSITION,
    signature: [
      sender.fullName.trim(),
      job,
      "Proposalyze",
      "Ayudas públicas · I+D+i",
      email,
    ].filter(Boolean).join("\n"),
    calendlyUrl: null,
    dailySendCap: 30,
  };
}

/** Fallback when no employee commercial identity is configured yet. */
export const DEFAULT_SENDER: CommercialSender = {
  userId: "default-ssanchez",
  fullName: "Santiago Sánchez",
  jobTitle: "Director Comercial",
  workEmail: "ssanchez@proposalyze.com",
};

export const SALES_STARTUPS: SalesStartup[] = [buildStartupFromSender(DEFAULT_SENDER)];
