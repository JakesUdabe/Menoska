import { describe, expect, it } from "vitest";
import {
  canUseNaturalLanguage,
  canUsePatents,
  maxActiveBulletins,
  maxAiGenerationsPerMonth,
  maxUsersPerOrg,
} from "./rbac";
import { planRequiredResponse } from "./api/plan-guard";
import { isMcRlsHelper, MC_RLS_HELPERS } from "./rls-helpers";

describe("canUsePatents", () => {
  it("allows business and enterprise", () => {
    expect(canUsePatents("business")).toBe(true);
    expect(canUsePatents("enterprise")).toBe(true);
  });

  it("denies starter and empty", () => {
    expect(canUsePatents("starter")).toBe(false);
    expect(canUsePatents(null)).toBe(false);
    expect(canUsePatents(undefined)).toBe(false);
  });
});

describe("maxUsersPerOrg", () => {
  it("caps starter at 3 and business at 10", () => {
    expect(maxUsersPerOrg("starter")).toBe(3);
    expect(maxUsersPerOrg(null)).toBe(3);
    expect(maxUsersPerOrg("business")).toBe(10);
    expect(maxUsersPerOrg("enterprise")).toBeNull();
  });
});

describe("maxActiveBulletins", () => {
  it("caps starter at 3", () => {
    expect(maxActiveBulletins("starter")).toBe(3);
    expect(maxActiveBulletins(null)).toBe(3);
  });

  it("is unlimited for business and enterprise", () => {
    expect(maxActiveBulletins("business")).toBeNull();
    expect(maxActiveBulletins("enterprise")).toBeNull();
  });
});

describe("maxAiGenerationsPerMonth", () => {
  it("starter is 20", () => {
    expect(maxAiGenerationsPerMonth("starter")).toBe(20);
    expect(maxAiGenerationsPerMonth(null)).toBe(20);
  });

  it("business is 200", () => {
    expect(maxAiGenerationsPerMonth("business")).toBe(200);
  });

  it("enterprise is unlimited", () => {
    expect(maxAiGenerationsPerMonth("enterprise")).toBeNull();
  });
});

describe("multi-tenant isolation helpers", () => {
  it("documents RLS helper functions used by mc_* policies", () => {
    expect(MC_RLS_HELPERS).toEqual([
      "private.mc_current_org_id",
      "private.mc_current_role",
      "private.mc_is_superadmin",
    ]);
    expect(isMcRlsHelper("private.mc_current_org_id")).toBe(true);
    expect(isMcRlsHelper("public.profiles")).toBe(false);
  });

  it("plan guard rejects wrong plan for NL / patents", () => {
    expect(canUseNaturalLanguage("starter")).toBe(false);
    expect(canUseNaturalLanguage("business")).toBe(true);
    expect(canUsePatents("starter")).toBe(false);
    const res = planRequiredResponse();
    expect(res.status).toBe(403);
  });
});
