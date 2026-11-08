import type { PatentHit } from "@/lib/patents/lens";
import type { ClaimSource, FtoPatentInput } from "./compare";
import { screeningClaimsFor } from "./corpus";

export function patentInputFromHit(hit: PatentHit, options?: { forceSource?: ClaimSource }): FtoPatentInput {
  const register = (hit.claims ?? []).map((claim) => claim.trim()).filter((claim) => claim.length > 20);
  let claims = register;
  let claimSource: ClaimSource = "register";
  if (options?.forceSource === "demo" && claims.length) {
    return {
      id: hit.id,
      title: hit.title,
      abstract: hit.abstract,
      url: hit.url,
      applicants: hit.applicants,
      ipc: hit.ipc,
      publishedAt: hit.publishedAt,
      claims,
      claimSource: "demo",
    };
  }
  if (!claims.length) {
    const demo = screeningClaimsFor(hit.id);
    if (demo.length) {
      claims = demo;
      claimSource = "demo";
    } else if (hit.abstract.trim().length > 40) {
      claims = [`1. ${hit.abstract.trim()}`];
      claimSource = "abstract";
    } else {
      claimSource = "abstract";
    }
  }
  return {
    id: hit.id,
    title: hit.title,
    abstract: hit.abstract,
    url: hit.url,
    applicants: hit.applicants,
    ipc: hit.ipc,
    publishedAt: hit.publishedAt,
    claims,
    claimSource,
    legalStatus: hit.legalStatus,
  };
}
