# Menoska Consulting

SaaS de vigilancia tecnológica, inteligencia de mercado, scouting y decisión financiera. Branding emerald `#00895B` + marengo `#394A51`.

## Quick start (demo mode)

Sin variables de Supabase la app corre en **modo demo** (localStorage).

```bash
npm install
npm run dev
```

Abre [http://localhost:3000/es](http://localhost:3000/es).

### Demo logins

| Usuario | Contraseña | Rol        |
|---------|------------|------------|
| `1234`  | `1234`     | client     |
| `1234a` | `1234a`    | superadmin |
| `1234b` | `1234b`    | admin      |

Tras registrarte en `/registro`, vuelve a entrar con **email + contraseña** (cuenta en `menoska_demo_accounts`).

## Architecture — 4 modules + projects

1. **Vigilancia / boletines** — filtros AND empresas×tecnologías, envío Resend o registro demo.
2. **Informes de inteligencia** — estado del arte, informe de mercado, social listening (LLM + plantillas).
3. **Scouting** — FTO / patentes (Lens → EPO → seed demo).
4. **Estrategia & finanzas** — calculadoras (TAM/SAM/SOM, fit, benchmarking, sensibilidad, modelos, capital, riesgo, account mapping) con estado en `menoska_worksheets`.
5. **Proyectos** — `/dashboard/proyectos` agrupa referencias a worksheets / informes / boletines (`mc_projects` + `mc_project_links`, o `menoska_projects` en demo).

## Password reset & verification

| Route | Uso |
|-------|-----|
| `/[locale]/recuperar` | Formulario email → `supabase.auth.resetPasswordForEmail` (en demo: toast, sin email) |
| `/[locale]/nueva-contrasena` | Tras el enlace de recovery (`/auth/callback?next=…`) → `updateUser({ password })` |
| Login | Enlace «¿Olvidaste tu contraseña?» |
| Registro | Si `needsVerification`, botón reenviar vía `supabase.auth.resend` |

## Security notes (CSRF / APIs)

- Sesión de app: cookies Supabase con **SameSite** (SSR `@supabase/ssr`).
- APIs autenticadas aceptan cookie de sesión **o** `Authorization: Bearer <access_token>` (útil para clientes SPA / demos con header).
- `/api/leads`: rate limit **10 req/hora por IP** (`clientIp` + `rateLimit`).

## Environment variables

| Variable | Uso |
|----------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Auth + datos (si faltan → demo) |
| `SUPABASE_SERVICE_ROLE_KEY` | Webhooks Stripe / admin |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Envío real de boletines |
| `STRIPE_SECRET_KEY` / `STRIPE_PRICE_*` | Billing. The webhook secret lives on Supabase as `STRIPE_WEBHOOK_SECRET_MENOSKA` |
| `STRIPE_PRICE_ADDON_SEATS` / `STRIPE_PRICE_ADDON_SENDS` | Add-ons (opcional) |
| `TAVILY_API_KEY` o `BRAVE_SEARCH_API_KEY` | Noticias del boletín. Con Tavily, el informe de mercado también recibe recortes web |
| `LENS_API_TOKEN` | Patentes cercanas y reivindicaciones del FTO. EPO es solo respaldo |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | Informes, NL query, investment memo |
| `NEXT_PUBLIC_SITE_URL` | URLs de Checkout / portal |

## Plan gating

APIs protegidas resuelven el plan del caller (`x-demo-plan` + `x-demo-user-id` en demo, o `mc_profiles` + `mc_organizations.plan` con Supabase):

- **NL query** y **patentes** → Business / Enterprise (`plan_required` 403 si no)
- **Informes** → todos los planes (con metering en `mc_ai_usage_events`)
- **Envío de boletines** → auth obligatoria; en producción el body del boletín no se confía (se carga por id)
- Starter: máximo 3 boletines activos
- Cuota IA mensual: Starter 20 · Business 200 · Enterprise ilimitado (`quota_exceeded` 429)

## Envío programado de boletines

No hay cron en Vercel. El envío programado quedará en un job de Supabase y, más adelante, en una VM. El handler `/api/cron/bulletins` sigue en el código por si ese job lo llama.

## Invitaciones de equipo

Admins: `/dashboard/equipo`. Aceptación pública: `/invitar?token=…`. Tabla `mc_organization_invites`; en demo, `menoska_invites` + cuenta en `menoska_demo_accounts`.

## Supabase (shared project)

El proyecto Supabase se **comparte con Proposalyze**. No tocar `public.profiles`, `public.organizations` ni `public.handle_new_user`.

El esquema `mc_*` **ya está aplicado** en el proyecto Supabase enlazado (`supabase/migrations/20261026190000_menoska_mc_schema.sql`).

La **demo sigue funcionando sin variables de entorno** (localStorage). Con Supabase configurado, repos dual-mode leen/escriben tablas `mc_*` y caen a local si falla la red o RLS.

**Ojo (DB compartida):** el registro vía Auth dispara el trigger `on_auth_user_created_menoska` → `menoska_handle_new_user`, que crea filas en `mc_profiles` (y org si aplica) en la misma base que Proposalyze. No uses signup de prueba a la ligera en el proyecto compartido.

## localStorage keys (demo)

- `menoska_demo_user` (migra desde `abi_demo_user`)
- `menoska_demo_accounts`
- `menoska_bulletins`, `menoska_orgs`, `menoska_worksheets`, `menoska_bulletin_deliveries`, `menoska_invites`, …
- `menoska_projects`, `menoska_activity`, `menoska_notifications_read`
- `menoska_ai_usage` — eventos de IA recientes (cliente, tras generate / NL)
- `menoska_quota_overrides` — add-ons demo (extra seats / sends / AI)
- `menoska_analytics_buffer`, `menoska_api_keys`, `menoska_webhooks`, `menoska_notification_store`
- Claves legacy `abi_*` se copian una vez si la nueva está vacía.

## API surface

| Route | Method | Notes |
|-------|--------|--------|
| `/api/health` | GET | `{ ok, demo, stripe, resend, supabase, ai, patents, ts }` — env presence only (no secrets) |
| `/api/v1` | GET | Public API catalog stub (`name`, `version`, `endpoints`) |
| `/api/me/export` | GET | GDPR JSON export (auth; demo via `x-demo-user-id` + optional `x-demo-export`) |
| `/api/cron/bulletins` | GET/POST | Reserved for a later scheduler; refuses calls while `CRON_SECRET` is unset |
| `/api/invites` | GET/POST | List / create org invites (auth) |
| `/api/invites/accept` | POST | Accept invite by token |
| `/api/patents/search` | POST | FTO search; Business+ (`plan_required` if not) |
| `/api/nl-query` | POST | Natural-language company/tech extract; Business+ |
| `/api/reports/generate` | POST | AI report generation |
| `/api/bulletins/send` | POST | Send / record briefing delivery |
| `/api/stripe/checkout` | POST | Stripe Checkout session |
| `/api/stripe/portal` | POST | Stripe customer portal |
| `/api/stripe/webhook` | POST | Stripe webhooks |
| `/api/leads` | POST | Contact form; **10/hour/IP**; works in demo without Supabase |
| `/api/usage` | GET | Optional org AI usage from `mc_ai_usage_events` (Supabase); demo uses client `menoska_ai_usage` |
| `/api/v1/webhooks` | GET/POST/DELETE | Org webhook CRUD (auth; org admin for writes) |
| `/api/v1/keys` | GET/POST/DELETE | Opaque `mk_…` API keys (hashed SHA-256; Bearer accepted only on `/api/v1/*`) |
| `/api/news/search` | POST | News search (auth); wired into bulletin editor “Buscar noticias” |

## Superadmin bootstrap

There is no automatic UI to create the first superadmin. After the first Auth user exists:

1. **Optional env:** set `SUPERADMIN_EMAIL` to that user’s email (documented for ops / future trigger wiring; see `.env.example`).
2. **Manual (recommended):** in Supabase SQL editor:

```sql
-- By auth user id (mc_profiles.id = auth.users.id):
update public.mc_profiles
set role = 'superadmin'
where id = '<auth.users uuid>';

-- Or resolve email via auth.users:
update public.mc_profiles p
set role = 'superadmin'
from auth.users u
where p.id = u.id and u.email = 'you@example.com';
```

Demo mode already has `1234a` / `1234a` as superadmin (no DB needed).

## Roadmap & Hito 1 ops

- [docs/ROADMAP.md](docs/ROADMAP.md) — visión + **Estado de implementación en código**
- [docs/HITO1_CHECKLIST.md](docs/HITO1_CHECKLIST.md) — Stripe/Resend live, Auth redirects, DPA/soporte

### Enterprise-shaped surfaces (scaffolding)

| Área | Rutas / libs |
|------|----------------|
| Legal / soporte | `/dpa`, `/soporte` (mailto + ticket ID), footer → Estado |
| Analytics | `/admin/analytics`, `src/lib/analytics.ts`, `mc_analytics_events`, NPS avg |
| News | `POST /api/news/search`, bulletin editor “Buscar noticias” |
| Integraciones | `/dashboard/integraciones` — webhooks + API keys UI |
| Webhooks / API keys | `/api/v1/webhooks`, `/api/v1/keys`, `sign.ts`, `api-keys.ts`, migración `mc_api_keys` |
| Health / prod checklist | `GET /api/health` flags; `/dashboard/seguridad` Production checklist |
| Packs / SSO / SCIM | `/dashboard/packs`, `/dashboard/seguridad`, `/api/scim/v2/Users` |
| Benchmarks / partners / memo | `/dashboard/benchmarks`, `/partners`, `/dashboard/modulos/finanzas/memo-inversion` |
| Categoría / PLG / ARR mock | `/innovation-capital-os`, `/demo-tam`, `/admin/arr` (orgs-repository) |

## Deploy

See [docs/DEPLOY.md](docs/DEPLOY.md) for env vars, migration order, Stripe webhook, cron secret, Auth redirect URLs, and Vercel settings.

## Scripts

- `npm run dev` — desarrollo
- `npm run build` — build producción
- `npm run lint` — ESLint
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — Vitest (`src/**/*.test.ts`)
- `npm run smoke` — `node scripts/smoke.mjs` (expects app up; `SITE_URL` or `http://localhost:3000`)
