export type SectorPack = {
  id: string;
  name: string;
  sector: "automotive" | "cleantech" | "healthtech";
  description: string;
  companies: string[];
  technologies: string[];
  bulletinSeed: {
    name: string;
    subject: string;
    sections: Array<{ title: string; companies: string[]; technologies: string[] }>;
  };
  reportHints: {
    kind: "estado_arte" | "informe_mercado" | "social_listening";
    title: string;
    focus: string;
  }[];
};

export const SECTOR_PACKS: SectorPack[] = [
  {
    id: "pack-automotive",
    name: "Automotive & movilidad",
    sector: "automotive",
    description: "Vigilancia OEM/Tier-1, baterías, ADAS y software-defined vehicles.",
    companies: ["Volkswagen", "Stellantis", "Bosch", "Continental"],
    technologies: ["Baterías de estado sólido", "ADAS L3", "SDV", "Hidrógeno"],
    bulletinSeed: {
      name: "Boletín Automotive EU",
      subject: "Señales automotive · UE",
      sections: [
        {
          title: "OEM & Tier-1",
          companies: ["Volkswagen", "Stellantis", "Bosch"],
          technologies: ["ADAS L3", "SDV"],
        },
        {
          title: "Energía a bordo",
          companies: ["Continental"],
          technologies: ["Baterías de estado sólido", "Hidrógeno"],
        },
      ],
    },
    reportHints: [
      { kind: "estado_arte", title: "Estado del arte SDV", focus: "Arquitecturas software-defined vehicle en Europa" },
      { kind: "informe_mercado", title: "Mercado baterías EU", focus: "Cadena de suministro de celdas en UE" },
    ],
  },
  {
    id: "pack-cleantech",
    name: "Cleantech industrial",
    sector: "cleantech",
    description: "Descarbonización industrial, storage, green H2 y captura de carbono.",
    companies: ["Iberdrola", "Engie", "Siemens Energy", "Acciona"],
    technologies: ["Green H2", "Almacenamiento", "CCUS", "Electrificación industrial"],
    bulletinSeed: {
      name: "Boletín Cleantech",
      subject: "Cleantech & industria · señales semanales",
      sections: [
        {
          title: "Utilities & EPC",
          companies: ["Iberdrola", "Engie", "Acciona"],
          technologies: ["Green H2", "Almacenamiento"],
        },
        {
          title: "Equipos",
          companies: ["Siemens Energy"],
          technologies: ["CCUS", "Electrificación industrial"],
        },
      ],
    },
    reportHints: [
      { kind: "informe_mercado", title: "TAM green H2 EU", focus: "Demanda industrial de hidrógeno verde" },
      { kind: "social_listening", title: "Narrativa ESG cleantech", focus: "Percepción de inversores en cleantech" },
    ],
  },
  {
    id: "pack-healthtech",
    name: "Healthtech & MedTech",
    sector: "healthtech",
    description: "Dispositivos, SaMD, evidencia clínica y AI Act en salud.",
    companies: ["Philips", "Siemens Healthineers", "Roche", "AstraZeneca"],
    technologies: ["SaMD", "Diagnóstico IA", "Wearables clínicos", "Terapias digitales"],
    bulletinSeed: {
      name: "Boletín Healthtech",
      subject: "Healthtech EU · regulación y scouting",
      sections: [
        {
          title: "MedTech",
          companies: ["Philips", "Siemens Healthineers"],
          technologies: ["SaMD", "Diagnóstico IA"],
        },
        {
          title: "Farma digital",
          companies: ["Roche", "AstraZeneca"],
          technologies: ["Wearables clínicos", "Terapias digitales"],
        },
      ],
    },
    reportHints: [
      { kind: "estado_arte", title: "SaMD & AI Act", focus: "Software como dispositivo médico bajo AI Act" },
      { kind: "informe_mercado", title: "Mercado terapias digitales", focus: "Adopción DTx en Europa" },
    ],
  },
];

export function getPack(id: string): SectorPack | undefined {
  return SECTOR_PACKS.find((p) => p.id === id);
}
