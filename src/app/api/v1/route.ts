import { NextResponse } from "next/server";

/** Public API catalog stub (v1). */
export async function GET() {
  return NextResponse.json({
    name: "Menoska Consulting API",
    version: "1.0.0",
    endpoints: [
      { method: "GET", path: "/api/v1", description: "API catalog (this resource)" },
      { method: "GET", path: "/api/v1/webhooks", description: "List org webhook endpoints (auth)" },
      { method: "POST", path: "/api/v1/webhooks", description: "Create webhook endpoint (auth)" },
      { method: "DELETE", path: "/api/v1/webhooks?id=", description: "Delete webhook endpoint (auth)" },
      { method: "GET", path: "/api/v1/keys", description: "List opaque API keys (org admin)" },
      { method: "POST", path: "/api/v1/keys", description: "Create API key mk_… (shown once; stored hashed)" },
      { method: "DELETE", path: "/api/v1/keys?id=", description: "Revoke API key (org admin)" },
      { method: "GET", path: "/api/health", description: "Liveness: ok, demo, stripe, resend, supabase, ai, patents" },
      { method: "GET", path: "/api/me/export", description: "GDPR data export (auth required)" },
      { method: "POST", path: "/api/reports/generate", description: "Generate intelligence report (auth + plan)" },
      { method: "POST", path: "/api/nl-query", description: "Natural-language extract (Business+)" },
      { method: "POST", path: "/api/patents/search", description: "Patent / FTO search (Business+)" },
      { method: "POST", path: "/api/news/search", description: "News search adapter (auth)" },
      { method: "POST", path: "/api/bulletins/send", description: "Send briefing (auth)" },
      { method: "GET", path: "/api/usage", description: "Recent AI usage (auth)" },
      { method: "POST", path: "/api/stripe/checkout", description: "Stripe Checkout session" },
      { method: "POST", path: "/api/stripe/portal", description: "Stripe customer portal" },
      { method: "GET", path: "/api/admin/audit/export", description: "SIEM CSV export of audit events (admin)" },
      { method: "POST", path: "/api/agents/investment-memo", description: "Investment memo agent draft (auth)" },
      { method: "GET|POST", path: "/api/scim/v2/Users", description: "SCIM Users stub (Enterprise required → 501)" },
    ],
    webhooks: {
      signing: "HMAC-SHA256 via x-menoska-signature (see src/lib/webhooks/sign.ts)",
      events: ["bulletin.sent"],
    },
  });
}
