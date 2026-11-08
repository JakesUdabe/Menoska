import { describe, expect, it } from "vitest";
import { parseEpoOpsHits } from "./lens";

const FIXTURE = {
  "ops:world-patent-data": {
    "ops:biblio-search": {
      "ops:search-result": {
        "ops:publication-reference": [
          {
            "document-id": {
              country: "EP",
              "doc-number": "1234567",
              kind: "A1",
            },
          },
          {
            "document-id": {
              country: "US",
              "doc-number": "9876543",
              kind: "B2",
            },
          },
        ],
      },
    },
  },
};

describe("parseEpoOpsHits", () => {
  it("maps OPS publication references into PatentHit[]", () => {
    const hits = parseEpoOpsHits(FIXTURE);
    expect(hits).toHaveLength(2);
    expect(hits[0]?.id).toBe("EP1234567A1");
    expect(hits[0]?.title).toContain("EP");
    expect(hits[0]?.url).toContain("espacenet.com");
    expect(hits[1]?.id).toBe("US9876543B2");
  });

  it("returns empty array for invalid input", () => {
    expect(parseEpoOpsHits(null)).toEqual([]);
    expect(parseEpoOpsHits({})).toEqual([]);
    expect(parseEpoOpsHits("x")).toEqual([]);
  });
});
