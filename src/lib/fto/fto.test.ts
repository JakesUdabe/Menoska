import { describe, expect, it } from "vitest";
import { screenFto } from "./compare";
import { demoPatentHits, showcaseRdf } from "./corpus";
import { productCorpus, RDF_LIMITS, validateRdf, type TechnicalRdf } from "./rdf";
import { patentInputFromHit } from "./prepare";
import { extractClaimTexts } from "@/lib/patents/lens";

describe("technical RDF", () => {
  it("accepts the showcase disclosure and rejects a short embodiment", () => {
    const rdf = showcaseRdf();
    expect(validateRdf(rdf)).toEqual({ ok: true });
    const short: TechnicalRdf = { ...rdf, embodiment: "Muy corto." };
    const check = validateRdf(short);
    expect(check.ok).toBe(false);
    if (!check.ok) {
      expect(check.gaps.some((gap) => gap.field === "embodiment" && gap.min === RDF_LIMITS.embodiment)).toBe(true);
    }
  });

  it("keeps active mitigation and BMS control out of the positive concept set", () => {
    const corpus = productCorpus(showcaseRdf());
    expect(corpus.positive.has("exhaust")).toBe(true);
    expect(corpus.positive.has("passive")).toBe(true);
    expect(corpus.positive.has("gas")).toBe(true);
    expect(corpus.positive.has("active")).toBe(false);
    expect(corpus.positive.has("control")).toBe(false);
    expect(corpus.negative.has("active")).toBe(true);
    expect(corpus.negative.has("control")).toBe(true);
  });
});

describe("FTO claim screen", () => {
  const report = screenFto(
    showcaseRdf(),
    demoPatentHits().map((hit) => patentInputFromHit(hit)),
  );

  it("ranks the passive exhaust patents ahead of temperature control", () => {
    expect(report.patents[0]?.id).toBe("US8268469B2");
    const temperature = report.patents.find((patent) => patent.id === "US8082743B2");
    const exhaust = report.patents.find((patent) => patent.id === "US8268469B2");
    expect(exhaust && temperature && exhaust.closeness).toBeGreaterThan(temperature?.closeness ?? 1);
  });

  it("reads the passive exhaust claim and stops on the active-mitigation claim", () => {
    const exhaust = report.patents.find((patent) => patent.id === "US8268469B2");
    const active = report.patents.find((patent) => patent.id === "US9093726B2");
    expect(exhaust?.claims[0]?.reading).toBe("lectura_potencial");
    expect(exhaust?.claims[0]?.elements.every((element) => element.verdict === "presente")).toBe(true);
    expect(active?.claims[0]?.reading).not.toBe("lectura_potencial");
    expect(active?.claims[0]?.elements.some((element) => element.verdict === "fuera")).toBe(true);
    expect(report.risk).toBe("Alto");
    expect(patentInputFromHit(demoPatentHits()[0]!, { forceSource: "demo" }).claimSource).toBe("demo");
  });

  it("does not let an abstract proxy alone set a high risk", () => {
    const screened = screenFto(showcaseRdf(), [
      {
        id: "XX1",
        title: "Passive battery pack gas exhaust enclosure",
        abstract: "Lithium cells, passive pressure vent, gas exhaust to the exterior during thermal runaway.",
        url: "https://example.com",
        applicants: ["Demo"],
        ipc: ["H01M"],
        publishedAt: "2020-01-01",
        claims: [
          "1. A battery pack comprising: an enclosure housing lithium-ion cells; a passive gas exhaust path to the exterior during thermal runaway; a pressure opening element.",
        ],
        claimSource: "abstract",
      },
    ]);
    expect(screened.patents[0]?.claims[0]?.reading).toBe("lectura_potencial");
    expect(screened.risk).toBe("Bajo");
  });
});

describe("extractClaimTexts", () => {
  it("reads nested claim text", () => {
    expect(extractClaimTexts([{ claim_text: "1. A battery pack comprising a gas exhaust path for thermal runaway." }])).toHaveLength(1);
  });
});
