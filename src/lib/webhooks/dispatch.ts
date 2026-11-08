import { buildWebhookSignatureHeader } from "./sign";
import { listWebhooksForOrg } from "./store";

export async function dispatchWebhooks(input: {
  organizationId: string | null | undefined;
  event: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  if (!input.organizationId) return;
  try {
    const hooks = await listWebhooksForOrg(input.organizationId);
    const active = hooks.filter((h) => h.active && h.events.includes(input.event));
    if (!active.length) return;

    const body = JSON.stringify({
      id: `evt_${Date.now()}`,
      type: input.event,
      created: Math.floor(Date.now() / 1000),
      data: input.payload,
    });

    await Promise.allSettled(
      active.map(async (hook) => {
        const headers: Record<string, string> = {
          "content-type": "application/json",
          "user-agent": "Menoska-Webhooks/1.0",
        };
        if (hook.secret) {
          headers["x-menoska-signature"] = buildWebhookSignatureHeader(body, hook.secret);
        }
        const res = await fetch(hook.url, { method: "POST", headers, body });
        if (!res.ok) {
          console.warn(`[webhooks] ${hook.id} → ${res.status}`);
        }
      }),
    );
  } catch (err) {
    console.warn("[webhooks] dispatch failed", err instanceof Error ? err.message : err);
  }
}
