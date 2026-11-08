import type { Locale } from "@/i18n/locales";
import type { CommercialAct, RdfField } from "./rdf";

export type FtoCopy = {
  method: string;
  disclaimer: string;
  run: string;
  running: string;
  incomplete: string;
  acts: string;
  actsHint: string;
  known: string;
  knownHint: string;
  sections: Record<"act" | "technical" | "elements" | "search", string>;
  actLabel: Record<CommercialAct, string>;
  fields: Record<RdfField, { label: string; hint: string }>;
  families: string;
  classLabel: string;
  risk: string;
  empty: string;
  contexts: string;
  closest: string;
  afterCutoff: string;
  claim: string;
  element: string;
  source: Record<"register" | "demo" | "abstract", string>;
  kind: Record<"independiente" | "dependiente" | "proxy", string>;
  reading: Record<"lectura_potencial" | "elemento_ausente" | "alejada", string>;
  verdict: Record<"presente" | "parcial" | "ausente" | "fuera", string>;
  demoNote: string;
  exportLabel: string;
};

const es: FtoCopy = {
  method:
    "Un FTO fija el acto comercial y la realización concreta, la parte en elementos y solo entonces busca patentes. Cada elemento de la reivindicación se contrasta con el RDF: si falta uno, no hay lectura literal.",
  disclaimer:
    "Cribado técnico. No es una opinión legal ni sustituye el texto oficial de las reivindicaciones cuando el registro no las devuelve.",
  run: "Generar contextos y cribar reivindicaciones",
  running: "Cribando…",
  incomplete: "Completa los campos por debajo del mínimo antes de cribar.",
  acts: "Actos para los que se pide libertad",
  actsHint: "Marca solo lo que de verdad se va a hacer. El FTO cubre ese acto, no un producto abstracto.",
  known: "Patentes ya identificadas",
  knownHint: "Números de publicación que el equipo ya tiene encima de la mesa. Opcional, pero entra en el contexto de búsqueda.",
  sections: {
    act: "1. Acto, territorio y fecha de corte",
    technical: "2. Problema, efecto y realización",
    elements: "3. Elementos, parámetros y límites",
    search: "4. Variantes y vocabulario de búsqueda",
  },
  actLabel: {
    fabricar: "Fabricar",
    usar: "Usar",
    ofrecer: "Ofrecer",
    vender: "Vender",
    importar: "Importar",
  },
  fields: {
    productName: {
      label: "Producto o proceso",
      hint: "Nombre con el que se va a fabricar, usar u ofrecer. Evita un título de marketing.",
    },
    commercialDetail: {
      label: "Quién hace el acto y dónde",
      hint: "Planta, cliente y frontera. Distingue fabricar en la UE de importar un conjunto ya montado.",
    },
    jurisdictions: {
      label: "Jurisdicciones",
      hint: "Países u oficinas donde el acto ocurre. Ejemplo: EP, ES, US.",
    },
    cutoff: {
      label: "Fecha de corte del diseño",
      hint: "Fecha en la que el diseño queda congelado (AAAA-MM-DD). Una publicación posterior se marca, no se tira: puede tener prioridad anterior.",
    },
    technicalProblem: {
      label: "Problema técnico",
      hint: "Qué falla si el producto no existe. Este texto alimenta el primer contexto de búsqueda.",
    },
    technicalEffect: {
      label: "Efecto técnico",
      hint: "Qué cambia de forma observable: presión, trayectoria del gas, temperatura, tiempo. Sin adjetivos comerciales.",
    },
    embodiment: {
      label: "Realización concreta",
      hint: "Cómo está construido, en orden. Componentes, conexiones y qué ocurre en uso. Las frases que empiezan por «No» cuentan como límite, no como elemento presente.",
    },
    essentialFeatures: {
      label: "Elementos esenciales, uno por línea",
      hint: "Cada línea será una fila del cuadro. Escribe la estructura, la función y la relación. Una línea que empiece por «No», «Sin» o «Ausencia» se trata como exclusión.",
    },
    materialsParameters: {
      label: "Materiales, rangos y condiciones",
      hint: "Lo que una reivindicación podría recitar con número: material, kPa, temperatura, química de celda.",
    },
    exclusions: {
      label: "Qué queda fuera del producto",
      hint: "Realizaciones que no se van a hacer. Si una reivindicación exige eso, el elemento se marca como fuera del producto.",
    },
    variants: {
      label: "Variantes que siguen dentro del acto",
      hint: "Alternativas que también se quieren libres: otro material, otra salida del conducto, otro número de celdas.",
    },
    vocabulary: {
      label: "Sinónimos y nombres de producto",
      hint: "Términos de búsqueda en el idioma de las patentes, nombres comerciales y de competidor.",
    },
    ipc: {
      label: "Clase IPC o CPC",
      hint: "Aunque sea provisional. Acota el contexto y no sustituye a los elementos.",
    },
  },
  families: "Familias cribadas",
  classLabel: "Clase",
  risk: "Riesgo de lectura",
  empty: "Completa el RDF y lanza el cribado. El resultado es un cuadro de elementos, no una lista de títulos.",
  contexts: "Contextos enviados a la búsqueda",
  closest: "Patentes más próximas",
  afterCutoff: "Publicación posterior al corte: revisar la prioridad antes de descartarla.",
  claim: "Reivindicación",
  element: "Elemento",
  source: {
    register: "Texto del registro",
    demo: "Texto de cribado: el registro no devolvió la reivindicación",
    abstract: "Proxy del resumen: no es una reivindicación y no eleva el riesgo por sí solo",
  },
  kind: {
    independiente: "Independiente",
    dependiente: "Dependiente",
    proxy: "Proxy",
  },
  reading: {
    lectura_potencial: "Lectura potencial: todos los elementos están en el producto",
    elemento_ausente: "Sin lectura literal: falta al menos un elemento",
    alejada: "Alejada del RDF",
  },
  verdict: {
    presente: "Presente",
    parcial: "Parcial",
    ausente: "Ausente",
    fuera: "Fuera del producto",
  },
  demoNote: "Sin respuesta del registro se usa el corpus de cribado del caso. El cuadro sigue la misma regla de elementos.",
  exportLabel: "Exportar cribado",
};

const en: FtoCopy = {
  method:
    "An FTO fixes the commercial act and the concrete embodiment, splits that embodiment into elements, and only then searches patents. Each claim element is checked against the RDF: if one is missing, there is no literal read-on.",
  disclaimer:
    "Technical screen. It is not a legal opinion and it does not replace official claim text when the register does not return it.",
  run: "Build contexts and screen claims",
  running: "Screening…",
  incomplete: "Fill every field up to its minimum before screening.",
  acts: "Acts for which freedom is sought",
  actsHint: "Tick only what will actually be done. The screen covers that act, not an abstract product.",
  known: "Patents already identified",
  knownHint: "Publication numbers already on the table. Optional, but they enter the search context.",
  sections: {
    act: "1. Act, territory and cutoff",
    technical: "2. Problem, effect and embodiment",
    elements: "3. Elements, parameters and limits",
    search: "4. Variants and search vocabulary",
  },
  actLabel: {
    fabricar: "Make",
    usar: "Use",
    ofrecer: "Offer",
    vender: "Sell",
    importar: "Import",
  },
  fields: {
    productName: {
      label: "Product or process",
      hint: "The name of what will be made, used or offered. Skip the marketing title.",
    },
    commercialDetail: {
      label: "Who performs the act, and where",
      hint: "Plant, customer and border. Making in the EU is not the same act as importing a finished assembly.",
    },
    jurisdictions: {
      label: "Jurisdictions",
      hint: "Countries or offices where the act happens. Example: EP, ES, US.",
    },
    cutoff: {
      label: "Design cutoff",
      hint: "Date the design is frozen (YYYY-MM-DD). A later publication is flagged, not dropped: it may claim an earlier priority.",
    },
    technicalProblem: {
      label: "Technical problem",
      hint: "What fails if this product does not exist. This text feeds the first search context.",
    },
    technicalEffect: {
      label: "Technical effect",
      hint: "What changes in an observable way: pressure, gas path, temperature, time. No commercial adjectives.",
    },
    embodiment: {
      label: "Concrete embodiment",
      hint: "How it is built, in order. Components, connections and what happens in use. Sentences that start with “No” count as limits, not as present elements.",
    },
    essentialFeatures: {
      label: "Essential elements, one per line",
      hint: "Each line becomes a chart row. State structure, function and relationship. A line that starts with “No”, “Sin” or “Ausencia” is treated as an exclusion.",
    },
    materialsParameters: {
      label: "Materials, ranges and conditions",
      hint: "What a claim might recite with a number: material, kPa, temperature, cell chemistry.",
    },
    exclusions: {
      label: "What the product does not include",
      hint: "Embodiments that will not be made. If a claim requires them, the element is marked outside the product.",
    },
    variants: {
      label: "Variants still inside the act",
      hint: "Alternatives that also need freedom: another material, another duct exit, another cell count.",
    },
    vocabulary: {
      label: "Synonyms and product names",
      hint: "Search terms in the language of the patents, plus trade and competitor names.",
    },
    ipc: {
      label: "IPC or CPC class",
      hint: "Even a provisional class. It scopes the context and does not replace the elements.",
    },
  },
  families: "Families screened",
  classLabel: "Class",
  risk: "Read-on risk",
  empty: "Complete the RDF and run the screen. The result is an element chart, not a list of titles.",
  contexts: "Contexts sent to search",
  closest: "Closest patents",
  afterCutoff: "Published after the cutoff: check priority before setting it aside.",
  claim: "Claim",
  element: "Element",
  source: {
    register: "Register text",
    demo: "Screening text: the register did not return the claim",
    abstract: "Abstract proxy: not a claim, and it cannot raise the risk by itself",
  },
  kind: {
    independiente: "Independent",
    dependiente: "Dependent",
    proxy: "Proxy",
  },
  reading: {
    lectura_potencial: "Potential read-on: every element is in the product",
    elemento_ausente: "No literal read-on: at least one element is missing",
    alejada: "Remote from the RDF",
  },
  verdict: {
    presente: "Present",
    parcial: "Partial",
    ausente: "Absent",
    fuera: "Outside the product",
  },
  demoNote: "When the register does not answer, the case screening corpus is used. The element rule stays the same.",
  exportLabel: "Export screen",
};

const ENGLISH: Locale[] = ["en", "fr", "de", "it", "pt", "zh", "ja"];

export function ftoCopy(locale: Locale): FtoCopy {
  return ENGLISH.includes(locale) ? en : es;
}
