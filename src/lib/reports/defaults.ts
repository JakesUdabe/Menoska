import type { ReportKind, ReportTemplate } from "./types";

const now = "2026-09-18T08:00:00.000Z";

export const DEFAULT_TEMPLATES: Record<ReportKind, ReportTemplate> = {
  estado_arte: {
    id: "tpl-estado-arte",
    kind: "estado_arte",
    name: "Estado del arte",
    description: "Informe tecnológico a partir del cuestionario del cliente y fuentes de vigilancia.",
    updatedAt: now,
    cuestionario: [
      { id: "tema", titulo: "Tecnología o tema a vigilar", tipo: "texto", descripcion: "Ej. electrónica flexible para automoción.", obligatorio: true },
      { id: "sector", titulo: "Sector y aplicación", tipo: "texto", descripcion: "Mercado o uso previsto.", obligatorio: true },
      { id: "preguntas", titulo: "Preguntas de investigación", tipo: "textarea", descripcion: "Qué debe responder el informe.", obligatorio: true },
      { id: "geografia", titulo: "Alcance geográfico", tipo: "texto", descripcion: "UE, global, países concretos…", obligatorio: false },
      { id: "periodo", titulo: "Horizonte temporal", tipo: "texto", descripcion: "Últimos 5 años, 2020-2026…", obligatorio: false },
      { id: "actores", titulo: "Actores o competidores de interés", tipo: "textarea", descripcion: "Empresas, centros o patentes de partida.", obligatorio: false },
    ],
    secciones: [
      {
        id: "alcance",
        titulo: "Alcance y metodología",
        prompts: [
          {
            id: "alcance_p1",
            titulo: "Marco del estudio",
            preguntaIds: ["tema", "sector", "preguntas", "geografia", "periodo"],
            recursos: ["articulos", "patentes"],
            modelo: "sencilla",
            prompt:
              "Redacta el alcance, las preguntas de investigación y la metodología de un estado del arte. Sé concreto con el tema, el sector y el recorte geográfico/temporal. No inventes fuentes; cita solo las aportadas.",
          },
        ],
      },
      {
        id: "panorama",
        titulo: "Panorama tecnológico",
        prompts: [
          {
            id: "panorama_p1",
            titulo: "Líneas tecnológicas",
            preguntaIds: ["tema", "sector", "preguntas"],
            recursos: ["articulos", "noticias", "patentes"],
            modelo: "compleja",
            prompt:
              "Describe el estado de la técnica: enfoques dominantes, madurez, cuellos de botella y resultados recientes. Organiza por líneas tecnológicas. Tono analítico, sin relleno.",
          },
        ],
      },
      {
        id: "actores_sec",
        titulo: "Actores y propiedad industrial",
        prompts: [
          {
            id: "actores_p1",
            titulo: "Mapa de actores",
            preguntaIds: ["tema", "actores", "geografia"],
            recursos: ["patentes", "noticias"],
            modelo: "media",
            prompt:
              "Identifica empresas, centros y familias de patentes relevantes. Señala posicionamiento y posibles huecos. Si hay lista de actores del cliente, úsala como eje.",
          },
        ],
      },
      {
        id: "brechas",
        titulo: "Brechas y oportunidades",
        prompts: [
          {
            id: "brechas_p1",
            titulo: "Oportunidades de I+D",
            preguntaIds: ["preguntas", "sector", "tema"],
            recursos: ["articulos", "patentes", "mercado"],
            modelo: "media",
            prompt:
              "Extrae brechas tecnológicas y oportunidades de I+D accionables para el cliente. Prioriza por impacto y viabilidad. Evita recomendaciones genéricas.",
          },
        ],
      },
      {
        id: "conclusiones",
        titulo: "Conclusiones",
        prompts: [
          {
            id: "conclusiones_p1",
            titulo: "Síntesis ejecutiva",
            preguntaIds: ["tema", "preguntas"],
            recursos: [],
            modelo: "sencilla",
            prompt:
              "Cierra con 4-6 conclusiones ejecutivas y la respuesta directa a las preguntas de investigación. Prosa densa, sin listas interminables.",
          },
        ],
      },
    ],
  },
  informe_mercado: {
    id: "tpl-informe-mercado",
    kind: "informe_mercado",
    name: "Informe de mercado",
    description: "Análisis de mercado, competencia y demanda a partir del cuestionario.",
    updatedAt: now,
    cuestionario: [
      { id: "mercado", titulo: "Mercado o producto", tipo: "texto", descripcion: "Qué mercado hay que analizar.", obligatorio: true },
      { id: "segmentos", titulo: "Segmentos de cliente", tipo: "textarea", descripcion: "A quién se dirige.", obligatorio: true },
      { id: "geografia", titulo: "Geografía", tipo: "texto", descripcion: "Países o regiones.", obligatorio: true },
      { id: "competidores", titulo: "Competidores conocidos", tipo: "textarea", descripcion: "Lista de partida.", obligatorio: false },
      { id: "horizonte", titulo: "Horizonte de planificación", tipo: "texto", descripcion: "Ej. 2026-2030.", obligatorio: false },
      { id: "objetivos", titulo: "Decisiones que debe apoyar el informe", tipo: "textarea", descripcion: "Entrar, pricing, partnership…", obligatorio: true },
    ],
    secciones: [
      {
        id: "definicion",
        titulo: "Definición del mercado",
        prompts: [
          {
            id: "def_p1",
            titulo: "Delimitación",
            preguntaIds: ["mercado", "segmentos", "geografia"],
            recursos: ["mercado", "noticias"],
            modelo: "sencilla",
            prompt:
              "Define el mercado, los segmentos y las fronteras con mercados adyacentes. Deja claro qué queda dentro y fuera del análisis.",
          },
        ],
      },
      {
        id: "tamano",
        titulo: "Tamaño, crecimiento y tendencias",
        prompts: [
          {
            id: "tamano_p1",
            titulo: "Dinámica",
            preguntaIds: ["mercado", "horizonte", "geografia"],
            recursos: ["mercado", "noticias", "articulos"],
            modelo: "compleja",
            prompt:
              "Analiza tamaño, crecimiento, drivers y tendencias. Distingue hecho observado de hipótesis. Si no hay cifra fiable, indícalo y da un rango cualitativo.",
          },
        ],
      },
      {
        id: "competencia",
        titulo: "Competencia",
        prompts: [
          {
            id: "comp_p1",
            titulo: "Mapa competitivo",
            preguntaIds: ["competidores", "mercado", "segmentos"],
            recursos: ["noticias", "mercado"],
            modelo: "media",
            prompt:
              "Compara competidores por oferta, posicionamiento y movimiento reciente. Incluye los citados por el cliente y otros relevantes de las fuentes.",
          },
        ],
      },
      {
        id: "demanda",
        titulo: "Demanda y criterios de compra",
        prompts: [
          {
            id: "demanda_p1",
            titulo: "Cliente",
            preguntaIds: ["segmentos", "objetivos"],
            recursos: ["voc", "noticias"],
            modelo: "media",
            prompt:
              "Describe necesidades, criterios de compra y fricciones de los segmentos. Conecta con las decisiones que el cliente quiere tomar.",
          },
        ],
      },
      {
        id: "reco",
        titulo: "Recomendaciones",
        prompts: [
          {
            id: "reco_p1",
            titulo: "Implicaciones",
            preguntaIds: ["objetivos", "mercado", "competidores"],
            recursos: [],
            modelo: "sencilla",
            prompt:
              "Traduce el análisis en recomendaciones priorizadas ligadas a las decisiones pedidas. Cada recomendación debe tener un porqué.",
          },
        ],
      },
    ],
  },
  social_listening: {
    id: "tpl-social-listening",
    kind: "social_listening",
    name: "Social listening y voice of customer",
    description: "Consulta APIs especializadas y redacta un informe de conversación y VoC.",
    updatedAt: now,
    cuestionario: [
      { id: "marcas", titulo: "Marcas, productos o temas", tipo: "textarea", descripcion: "Uno por línea.", obligatorio: true },
      { id: "keywords", titulo: "Palabras clave y hashtags", tipo: "textarea", descripcion: "Términos de búsqueda.", obligatorio: true },
      { id: "plataformas", titulo: "Fuentes a vigilar", tipo: "texto", descripcion: "Noticias, LinkedIn, foros, reseñas, web…", obligatorio: true },
      { id: "periodo", titulo: "Periodo", tipo: "texto", descripcion: "Últimos 30 días, trimestre…", obligatorio: true },
      { id: "idioma", titulo: "Idiomas de la conversación", tipo: "texto", descripcion: "es, en…", obligatorio: false },
      { id: "objetivo", titulo: "Qué decisión debe informar el informe", tipo: "textarea", descripcion: "Reputación, producto, lanzamiento…", obligatorio: true },
    ],
    secciones: [
      {
        id: "universo",
        titulo: "Universo de conversación",
        prompts: [
          {
            id: "uni_p1",
            titulo: "Volumen y focos",
            preguntaIds: ["marcas", "keywords", "plataformas", "periodo"],
            recursos: ["redes_sociales", "noticias"],
            modelo: "media",
            prompt:
              "Resume dónde y de qué se habla: fuentes, focos temáticos y marcas asociadas. Apóyate en los resultados de las APIs, no inventes citas.",
          },
        ],
      },
      {
        id: "sentimiento",
        titulo: "Temas y sentimiento",
        prompts: [
          {
            id: "sent_p1",
            titulo: "Mapa de temas",
            preguntaIds: ["marcas", "keywords", "objetivo"],
            recursos: ["redes_sociales", "voc"],
            modelo: "compleja",
            prompt:
              "Agrupa la conversación en temas, con tono (positivo/neutro/negativo) y ejemplos parafraseados. Señaliza controversias o picos.",
          },
        ],
      },
      {
        id: "voc",
        titulo: "Voice of customer",
        prompts: [
          {
            id: "voc_p1",
            titulo: "Voces del cliente",
            preguntaIds: ["marcas", "objetivo"],
            recursos: ["voc", "redes_sociales"],
            modelo: "media",
            prompt:
              "Sintetiza necesidades, quejas y elogios recurrentes como voice of customer. Distingue clientes, no clientes y prescriptores cuando se pueda.",
          },
        ],
      },
      {
        id: "riesgos",
        titulo: "Riesgos y oportunidades",
        prompts: [
          {
            id: "riesgos_p1",
            titulo: "Alertas",
            preguntaIds: ["objetivo", "marcas"],
            recursos: ["redes_sociales", "noticias"],
            modelo: "media",
            prompt:
              "Lista riesgos reputacionales u operativos y oportunidades de mensaje o producto derivadas de la conversación.",
          },
        ],
      },
      {
        id: "acciones",
        titulo: "Recomendaciones de acción",
        prompts: [
          {
            id: "acc_p1",
            titulo: "Plan breve",
            preguntaIds: ["objetivo"],
            recursos: [],
            modelo: "sencilla",
            prompt:
              "Propón acciones concretas (escucha, contenido, producto, atención) ligadas al objetivo del cliente. Máximo una página.",
          },
        ],
      },
    ],
  },
};
