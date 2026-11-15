import type { SalesStartup } from "./types";

export type CommercialSender = {
  userId: string;
  fullName: string;
  jobTitle: string;
  workEmail: string;
};

const DOMAIN = "menoska-consulting.com";
const TONE =
  "Directo, breve y concreto. Sin hype ni plantillas. Ancla el mensaje en la situación real de tesorería, modelo o capital de la empresa y en cómo Menoska lo trabaja con su equipo.";
const VALUE_PROPOSITION =
  "Dirección financiera externa para empresas tecnológicas e industriales: modelos, tesorería, capital, fiscalidad, ingresos y financiación no dilutiva.";

export function buildStartupFromSender(sender: CommercialSender): SalesStartup {
  const job = sender.jobTitle.trim() || "Equipo comercial";
  const email = sender.workEmail.trim().toLowerCase();
  return {
    id: "menoska",
    name: "Menoska",
    domain: DOMAIN,
    fromName: sender.fullName.trim() || "Proposalyze",
    fromEmail: email,
    tone: TONE,
    valueProposition: VALUE_PROPOSITION,
    signature: [
      sender.fullName.trim(),
      job,
      "Menoska Consulting",
      "Dirección financiera",
      email,
    ].filter(Boolean).join("\n"),
    calendlyUrl: null,
    dailySendCap: 30,
  };
}

/** Fallback when no employee commercial identity is configured yet. */
export const DEFAULT_SENDER: CommercialSender = {
  userId: "default-judabe",
  fullName: "Jakes Udabe Sánchez",
  jobTitle: "Socio fundador y partner",
  workEmail: "info@menoska-consulting.com",
};

export const SALES_STARTUPS: SalesStartup[] = [buildStartupFromSender(DEFAULT_SENDER)];
