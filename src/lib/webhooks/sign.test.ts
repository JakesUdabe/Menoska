import { describe, expect, it } from "vitest";
import { buildWebhookSignatureHeader, signWebhookPayload, verifyWebhookSignature } from "./sign";

describe("webhook HMAC signing", () => {
  it("signs and verifies a payload", () => {
    const body = JSON.stringify({ type: "bulletin.sent", data: { id: "1" } });
    const secret = "whsec_test_secret";
    const header = buildWebhookSignatureHeader(body, secret, 1_700_000_000);
    expect(header).toMatch(/^t=1700000000,v1=[a-f0-9]+$/);
    expect(verifyWebhookSignature(body, secret, header, 10_000_000_000)).toBe(true);
  });

  it("rejects tampered body", () => {
    const secret = "whsec_test_secret";
    const header = buildWebhookSignatureHeader("{}", secret, 1_700_000_000);
    expect(verifyWebhookSignature("{tampered}", secret, header, 10_000_000_000)).toBe(false);
  });

  it("produces stable hex digest", () => {
    expect(signWebhookPayload("abc", "s")).toHaveLength(64);
  });
});
