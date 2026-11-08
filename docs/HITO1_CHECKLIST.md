# Hito 1 — Checklist operativo (MVP comercial)

Código y UI están listos; este checklist cubre lo que **no** se puede cerrar solo con repositorio.

## Entorno

- [ ] `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` en producción
- [ ] `SUPABASE_SERVICE_ROLE_KEY` solo en servidor (Vercel / secret store)
- [ ] Migraciones `mc_*` aplicadas (incl. `20261026300000_mc_hitos_…`)
- [ ] `NEXT_PUBLIC_SITE_URL` = URL canónica (https)

## Auth (Supabase)

- [ ] Site URL y Redirect URLs: `{SITE}/auth/callback`, `{SITE}/{locale}/nueva-contrasena`
- [ ] Email templates (confirmación / reset) con branding Menoska
- [ ] Verificar que el trigger `menoska_handle_new_user` solo actúa con `product=menoska`
- Código: `auth/callback` redirige `type=recovery` → `/{locale}/nueva-contrasena`; checklist de env en `/dashboard/seguridad` (flags de `GET /api/health`)

## Correo (Resend)

- [ ] `RESEND_API_KEY` live (no solo sandbox)
- [ ] `RESEND_FROM_EMAIL` con dominio verificado (SPF/DKIM/DMARC)
- [ ] Probar envío real de un boletín a bandeja propia

## Stripe live

- [ ] `STRIPE_SECRET_KEY` (live) + `STRIPE_WEBHOOK_SECRET`
- [ ] Price IDs: `STRIPE_PRICE_STARTER` / `BUSINESS` / `ENTERPRISE`
- [ ] Opcional add-ons: `STRIPE_PRICE_ADDON_SEATS`, `STRIPE_PRICE_ADDON_SENDS`
- [ ] Webhook endpoint `POST /api/stripe/webhook` con eventos de suscripción
- [ ] Portal de cliente activado en Dashboard Stripe

## Legal / soporte

- [ ] Revisar con counsel: ToS, privacidad, DPA (`/dpa`), cookies
- [ ] Buzón `soporte@…` / SLA publicado en `/soporte`
- [ ] Página `/estado` actualizada (`public/status.json`)

## Analytics

- [ ] Confirmar inserts en `mc_analytics_events` tras signup / login / send / checkout / report
- [ ] Definir funnel de activación en dashboard interno (fuera de vanity metrics)

## Happy path

- [ ] Cuenta real: crear boletín → enviar → generar informe (&lt;30 min)
- [ ] Checklist / wizard de onboarding visible al primer login

## Bloqueado externo (no código)

- Primeros clientes de pago, fiscalidad UE (IVA), deliverability a escala, SOC2.
