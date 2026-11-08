import { describe, expect, it } from "vitest";
import { classifyLegalEvents, cqlFromFreeText, parseEpoBiblioDocs } from "./epo";

describe("EPO query and biblio", () => {
  it("turns free text into a title-and-abstract query and keeps the IPC class", () => {
    expect(cqlFromFreeText("thermal runaway H01M10/625")).toBe(
      'ta all "thermal" and ta all "runaway" and ic=H01M10',
    );
  });

  it("reads a publication with title, applicant and class", () => {
    const hits = parseEpoBiblioDocs({
      "ops:world-patent-data": {
        "ops:biblio-search": {
          "ops:search-result": {
            "exchange-documents": {
              "exchange-document": {
                "bibliographic-data": {
                  "publication-reference": {
                    "document-id": {
                      country: { $: "EP" },
                      "doc-number": { $: "3000001" },
                      kind: { $: "A1" },
                      date: { $: "20200315" },
                    },
                  },
                  "invention-title": { "@lang": "en", $: "Gas exhaust for a battery pack" },
                  parties: {
                    applicants: {
                      applicant: { "applicant-name": { name: { $: "MENOSKA LABS" } } },
                    },
                  },
                  "classifications-ipcr": {
                    "classification-ipcr": { text: { $: "H01M10/625" } },
                  },
                },
                abstract: { p: { $: "A passive duct vents gas from a cell." } },
              },
            },
          },
        },
      },
    });
    expect(hits).toHaveLength(1);
    expect(hits[0]?.id).toBe("EP3000001A1");
    expect(hits[0]?.title).toBe("Gas exhaust for a battery pack");
    expect(hits[0]?.applicants).toEqual(["MENOSKA LABS"]);
    expect(hits[0]?.ipc[0]).toBe("H01M10/625");
    expect(hits[0]?.publishedAt).toBe("2020-03-15");
    expect(hits[0]?.abstract).toContain("passive duct");
  });

  it("treats a later lapse as not in force", () => {
    expect(
      classifyLegalEvents([
        { date: "20200101", title: "PATENT GRANTED" },
        { date: "20240101", title: "LAPSED IN A CONTRACTING STATE" },
      ]),
    ).toBe("dead");
    expect(classifyLegalEvents([{ date: "20220101", title: "ANNUAL FEE PAID" }])).toBe("alive");
  });
});
