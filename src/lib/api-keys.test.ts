import { describe, expect, it } from "vitest";
import { generateApiKey, hashApiKey, isApiKeyBearer } from "./api-keys";

describe("api key hash helpers", () => {
  it("hashes deterministically with sha256 hex", () => {
    const a = hashApiKey("mk_abc");
    const b = hashApiKey("mk_abc");
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
    expect(a).toMatch(/^[a-f0-9]+$/);
  });

  it("generates opaque mk_ keys and matching hash", () => {
    const { raw, hash, prefix } = generateApiKey();
    expect(raw.startsWith("mk_")).toBe(true);
    expect(isApiKeyBearer(raw)).toBe(true);
    expect(hashApiKey(raw)).toBe(hash);
    expect(prefix.startsWith("mk_")).toBe(true);
  });

  it("rejects non-mk bearers", () => {
    expect(isApiKeyBearer("sk_live_x")).toBe(false);
    expect(isApiKeyBearer("Bearer mk_x")).toBe(false);
  });
});
