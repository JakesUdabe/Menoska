import { createHmac, timingSafeEqual } from "crypto";

/** HMAC-SHA256 hex digest of body with secret (Stripe-style webhook signing). */
export function signWebhookPayload(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

/** Header value: `t=<unix>,v1=<hex>` */
export function buildWebhookSignatureHeader(body: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const signed = signWebhookPayload(`${timestamp}.${body}`, secret);
  return `t=${timestamp},v1=${signed}`;
}

export function verifyWebhookSignature(body: string, secret: string, header: string, toleranceSec = 300): boolean {
  try {
    const parts = Object.fromEntries(
      header.split(",").map((p) => {
        const [k, ...rest] = p.trim().split("=");
        return [k, rest.join("=")];
      }),
    ) as { t?: string; v1?: string };
    const t = Number(parts.t);
    const v1 = parts.v1;
    if (!t || !v1 || Number.isNaN(t)) return false;
    if (Math.abs(Math.floor(Date.now() / 1000) - t) > toleranceSec) return false;
    const expected = signWebhookPayload(`${t}.${body}`, secret);
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(v1, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
