/** Concept ids shared by a Spanish RDF and English claim text. */

const LEXICON: Record<string, string[]> = {
  pack: ["pack", "battery", "bateria"],
  cell: ["cell", "cells", "celda", "celdas", "electrochemical"],
  enclosure: ["enclosure", "housing", "recinto", "carcasa"],
  exhaust: ["exhaust", "vent", "venting", "venteo", "escape", "duct", "conducto", "efluente"],
  gas: ["gas", "gases"],
  thermal: ["thermal", "termico", "temperatura", "temperature", "heat", "calor"],
  runaway: ["runaway"],
  pressure: ["pressure", "presion", "kpa"],
  passive: ["passive", "pasivo", "pasiva", "burst", "ruptura", "disco"],
  active: [
    "active",
    "activa",
    "activo",
    "injects",
    "injection",
    "inyeccion",
    "suppressant",
    "extintor",
    "pump",
    "bomba",
    "actuator",
    "actuador",
    "valve",
    "valvula",
    "motorizada",
    "motorized",
  ],
  lithium: ["lithium", "litio", "nmc"],
  exterior: ["exterior", "outside", "habitaculo", "cabin"],
  control: ["controller", "control", "bms", "sensor", "optimizes", "optimize", "optimiza", "optimizacion"],
};

export const SEARCH_PHRASE: Record<string, string> = {
  pack: "battery pack",
  cell: "cell",
  enclosure: "enclosure",
  exhaust: "gas exhaust",
  gas: "vent gas",
  thermal: "thermal",
  runaway: "thermal runaway",
  pressure: "pressure relief",
  passive: "passive vent",
  active: "active mitigation",
  lithium: "lithium-ion",
  exterior: "exterior",
  control: "temperature control",
};

const TOKEN_TO_CONCEPT: Record<string, string> = {};
for (const [id, words] of Object.entries(LEXICON)) {
  for (const word of words) TOKEN_TO_CONCEPT[fold(word)] = id;
}

export function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function tokens(value: string): string[] {
  return fold(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);
}

export function conceptsIn(value: string): Set<string> {
  const found = new Set<string>();
  for (const token of tokens(value)) {
    const id = TOKEN_TO_CONCEPT[token];
    if (id) found.add(id);
  }
  return found;
}

const STOP = new Set(
  "para como cuando donde desde hasta este esta estos estas hacia sobre entre cada solo sin una uno con del las los que por sus son puede hacen falta hace falta sobre bajo tras entre mediante durante dentro hacia the and for with from that this into during which wherein comprising having about into onto pack".split(
    " ",
  ),
);

export function distinctiveWords(value: string, limit: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of tokens(value)) {
    if (token.length < 4 || STOP.has(token) || seen.has(token)) continue;
    seen.add(token);
    out.push(token);
    if (out.length >= limit) break;
  }
  return out;
}
