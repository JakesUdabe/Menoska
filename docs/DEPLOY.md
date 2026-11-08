# Menoska Consulting — deploy checklist

Internal checklist for production (Vercel + Supabase + Stripe).

## 1. Environment variables (Vercel)

Set these in the Vercel project → Settings → Environment Variables (Production + Preview as needed):

| Variable | Required | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_SITE_URL` | Yes | Canonical origin, e.g. `https://menoska.com` (no trailing slash) |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes (prod) | Menoska Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes (prod) | Anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (prod) | Server only — Stripe webhooks, admin writes |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | For bulletins | Real email send |
| `STRIPE_SECRET_KEY` | Billing | Secret key. Checkout is server-side, so no publishable key |
| `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_BUSINESS` / `STRIPE_PRICE_ENTERPRISE` | Billing | Price IDs |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` (or `GOOGLE_GENERATIVE_AI_API_KEY`) | Reports / NL | At least one AI provider |
| `LENS_API_TOKEN` | Patents | FTO search and claims. Demo seed if missing |
| `EPO_OPS_KEY` / `EPO_OPS_SECRET` | Patents | Optional fallback; no claims |
| `SUPERADMIN_EMAIL` | Optional | Documented bootstrap; role can also be set in DB |
| `TAVILY_API_KEY` or `BRAVE_SEARCH_API_KEY` | News | One is enough. Tavily also feeds market-report snippets |

Without Supabase public env vars the app runs in **demo mode** (localStorage). Do not ship demo mode to the real domain.

## 2. Apply migrations (order)

Apply SQL under `supabase/migrations/` in filename order (timestamp ascending). On a shared Supabase project with Proposalyze, only apply Menoska `mc_*` migrations; **do not** alter Proposalyze `public.profiles` / `organizations`.

Typical Menoska order:

1. `20261026190000_menoska_mc_schema.sql` — core `mc_*` schema  
2. `20261026200000_mc_organization_invites.sql` — invites  
2b. `20261026220000_mc_invites_token_rls_fix.sql` — invite token lookup RPC (drops leaky anon SELECT)  
3. `20261026210000_mc_projects_activity.sql` — projects + activity  

Older `20260918*` files are legacy ABI News; skip if you are on a greenfield `mc_*` project that already has the October migrations.

Verify with Supabase MCP / SQL editor: tables `mc_profiles`, `mc_organizations`, `mc_bulletins`, `mc_intelligence_reports`, `mc_projects`, `mc_activity_events`, etc. exist.

## 3. Stripe webhook

The live endpoint is already `https://nheyqairforzviwheyrq.supabase.co/functions/v1/menoska-stripe-webhook`. Its signing secret is the Supabase Edge secret `STRIPE_WEBHOOK_SECRET_MENOSKA`. Checkout does not use a publishable key.

## 4. Scheduled bulletin sends

Vercel Cron is not used. A later Supabase scheduled job, and after that a VM, will call the sender. `vercel.json` only sets headers.

## 5. Supabase Auth redirect URLs

In Supabase → Authentication → URL configuration:

**Site URL:** `https://<your-domain>` (or `NEXT_PUBLIC_SITE_URL`)

**Redirect URLs** (allowlist), include:

- `https://<your-domain>/auth/callback`
- `https://<your-domain>/es/nueva-contrasena` (and other locales you ship, e.g. `/en/nueva-contrasena`)
- Local: `http://localhost:3000/auth/callback`, `http://localhost:3000/es/nueva-contrasena`

Password recovery and invite flows use `/auth/callback?next=…` then land on `/[locale]/nueva-contrasena` when resetting.

## 6. Vercel project settings

- Framework: **Next.js** (auto-detected).  
- Root directory: repository root (the Next.js app lives here).  
- Build: `npm run build` / Install: `npm install`.  
- Node: 20.x recommended.  
- Headers/CSP come from `vercel.json` — do not duplicate conflicting CSP in the dashboard.  
- After first deploy: run `npm run smoke` against production (`SITE_URL=https://… npm run smoke`).

## 7. Post-deploy smoke

```bash
SITE_URL=https://<your-domain> npm run smoke
```

Expects `/api/health` → `{ ok: true }` and optionally `/es` → 200.

## 8. Superadmin

See README “Superadmin bootstrap”: set role on `mc_profiles` (or use `SUPERADMIN_EMAIL` if wired in your Auth trigger).
