# Roadmap Menoska Consulting — de producto usable a SaaS multimillonario

## Norte

Menoska Consulting se posiciona como el sistema operativo de **capital de innovación** para Europa: el lugar donde el director de innovación y el CFO comparten la misma evidencia (vigilancia tecnológica, FTO, mercado, scouting) y la traducen a decisión financiera (escenarios, riesgo, estructura de capital). La cuña comercial es EU-first (residencia de datos, DPA, idiomas), con un happy path claro — boletín + informe — y una plataforma multi-módulo que justifica expansión de asientos y ARR enterprise sin abandonar el self-serve.

## Hito 0 — Ya construido (código actual)

**Objetivo:** Base de producto demostrable (demo + esquema `mc_*`) sobre la que se puede iterar hacia cobro real.

**Entregables (honestos, sin métricas inventadas):**

- App Next.js multi-idioma con marketing, auth demo y rutas de producto.
- Modo demo con localStorage y logins fijos (`1234` / `1234a` / `1234b`); dual-mode hacia Supabase (`mc_*`) cuando hay env.
- Boletines (filtros AND, envío Resend o registro demo, cron stub).
- Informes de inteligencia (estado del arte, mercado, social listening) + plantillas admin.
- Scouting patentes (Lens → EPO → seed demo) y consultas NL (Business+).
- Módulos estrategia & finanzas con worksheets persistidos.
- Proyectos, actividad, invitaciones de equipo, Stripe checkout/portal/webhook stubs.
- Plan gating, metering IA (`mc_ai_usage_events` / local), cuotas mensuales por plan.
- Auditoría (`audit.*`), export RGPD `/api/me/export`, status page, catálogo API `/api/v1`.

**Métricas:** N/A como hechos de negocio — el producto aún no reporta ARR ni churn reales en producción.

**Riesgos:** Confundir demo pulida con readiness de cobro; deuda de aislamiento multi-tenant y compliance aún abierta.

## Hito 1 — MVP comercial (0–3 meses)

**Objetivo:** Cobrar los primeros euros con un happy path fiable y legal mínimo viable.

**Entregables:**

- Auth producción (Supabase) estable: signup, verificación, reset, roles.
- Resend en vivo para boletines; plantilla y deliverability básicos.
- Stripe live (Checkout + portal + webhooks) con planes Starter / Business.
- Un happy path medible: crear boletín → envío programado → generar un informe.
- Onboarding guiado (checklist → primer valor en &lt;30 min).
- Legal: ToS, privacidad, DPA bajo petición, cookies/avisos.
- Soporte: bandeja única (email) + SLA de respuesta comercial.
- Analytics básicos (funnel signup → activación → pago) sin inventar vanity metrics.

**Métricas:**

- Primeros clientes de pago (diseño: 3–10 early adopters).
- Tiempo a primer boletín enviado / primer informe generado.
- Tasa de activación post-signup (definición explícita en el dashboard interno).

**Riesgos:**

- Integraciones patent/news aún mock → expectativa de “datos reales” frustrada.
- Stripe + fiscalidad UE (IVA) mal configurados.
- Soporte manual que no escala si el onboarding falla.

## Hito 2 — Product-market fit (3–9 meses)

**Objetivo:** Retención: que el producto sea imprescindible en el ritmo semanal del equipo de innovación/finanzas.

**Entregables:**

- APIs de patentes y fuentes de noticias en producción (contratos Lens/EPO u equivalentes).
- Fiabilidad de envíos programados (monitoreo, reintentos, alertas).
- Calidad de plantillas de informe (revisión humana + evaluación LLM).
- 5 design partners con feedback estructurado y case studies.
- Empaquetado usage-based (cuotas IA, add-ons de asientos/envíos).
- NPS / entrevistas de retención; playbook de success.

**Métricas:**

- Retención logo y net revenue retention (objetivos a fijar tras primeros 10 clientes).
- NPS y % de design partners que renuevan.
- Uso semanal de boletines / módulos financieros por cuenta activa.

**Riesgos:**

- Optimizar features en vez de el job-to-be-done del CFO + Innovation Director.
- Coste de APIs/LLM que erosiona margen Starter.
- Case studies bloqueados por confidencialidad.

## Hito 3 — Escala (9–18 meses)

**Objetivo:** Vender a mid-market / enterprise sin romper el producto self-serve.

**Entregables:**

- Aislamiento multi-tenant endurecido (RLS auditado, tests de fuga, entornos).
- SSO/SAML + SCIM (aprovisionamiento).
- Exportaciones de auditoría hacia SIEM; inicio SOC 2.
- API pública versionada + webhooks (eventos de envío, uso, billing).
- Marketplace de packs sectoriales (plantillas + taxonomías).
- Pulido mobile-responsive; motion comercial multi-idioma (ventas EU).

**Métricas:**

- % de ARR en contratos anuales / enterprise.
- Tiempo de onboarding SSO &lt; X días.
- Cobertura de tests de seguridad multi-tenant.

**Riesgos:**

- SOC 2 / SSO retrasan deals; scope creep de “enterprise custom”.
- API pública sin versionado/rate limits genera deuda de soporte.
- Marketplace sin control de calidad diluye la marca.

## Hito 4 — Plataforma (18–36 meses)

**Objetivo:** Efectos de red y profundidad de categoría; expansión geográfica controlada.

**Entregables:**

- Benchmarks anonimizados (red de datos) con opt-in y gobernanza.
- Profundidad módulo M&A / scouting corporativo.
- Canal de partners (consultoras, bancos de inversión boutique).
- Opcional: embedded finance / enlaces bancarios (solo si hay demanda y licencia clara).
- Agentes IA que proponen investment memos con trazabilidad de fuentes.
- ISO / SOC 2 Type II; expansión US / LATAM con localización legal.

**Métricas:**

- % de cuentas que usan ≥3 módulos.
- Ingresos de canal partner.
- Adopción de agentes con aceptación humana (human-in-the-loop).

**Riesgos:**

- Sobre-prometer “agentes autónomos” sin control de alucinaciones.
- Expansión geográfica antes de product-market fit en EU.
- Complejidad regulatoria de embedded finance.

## Hito 5 — Categoría dominante

**Objetivo:** Definir y liderar la categoría **Innovation Capital OS**: de la señal tecnológica al capital asignado.

**Entregables:**

- Category design (narrativa, analistas, eventos, contenido CFO/CTO).
- M&A de herramientas menores de scouting / vigilancia para acelerar cobertura.
- Dual motion PLG + enterprise (self-serve + hunting).
- Hitos de ARR ambiciosos — **solo como brújula**, no como hechos actuales:
  - ~$1M ARR: motor de retención + 1 vertical dominante + branding EU claro.
  - ~$10M ARR: SSO/SCIM estándar, API/webhooks, canal partner, SOC 2 Type II.
  - ~$50M+ ARR: red de benchmarks, M&A tuck-ins, presencia multi-región, PLG a escala.

**Métricas:**

- Share of voice en la categoría; win-rate vs. stack fragmentado (Notion+alerts+Excel).
- NRR &gt; 120 % en el segmento enterprise (objetivo aspiracional).
- Coste de adquisición vs. LTV por motion (PLG vs. enterprise).

**Riesgos:**

- Competidores horizontales (Microsoft, Bloomberg-like) o niches verticales bien financiados.
- Dilución de foco si M&A no se integra al OS.
- Regulación IA / datos que cambia el coste de compliance.

## Inversión / equipo sugerido (roles)

| Fase | Roles clave |
|------|-------------|
| Hito 1 | Founder/CEO comercial, full-stack (ya), diseñador part-time, counsel externo (DPA/ToS) |
| Hito 2 | Customer success / design partners, data/ML part-time, marketer B2B content |
| Hito 3 | Security/compliance lead (o Fractional CISO), enterprise AE, solutions engineer |
| Hito 4+ | Partner manager, data platform eng, legal/privacy in-house o retainer fuerte |

Inversión orientativa: bootstrap + early revenue en Hito 1; ronda seed/Series A tipicamente alineada con Hito 2–3 cuando haya retención demostrable (no antes de inventar métricas).

## Moats (defensibilidad)

1. **Workflow CFO × Innovation** — no solo “alertas de patentes”: la misma evidencia alimenta finanzas y scouting.
2. **EU trust** — residencia, DPA, idiomas, postura compliance como default, no como add-on tardío.
3. **Datos + plantillas** — taxonomías sectoriales y calidad editorial de informes que mejoran con design partners.
4. **Network effects controlados** — benchmarks anonimizados (Hito 4) sin vender datos crudos de clientes.
5. **Switching costs** — historial de boletines, proyectos, worksheets y auditoría embebidos en el ritmo del equipo.
6. **API + packs** — ecosistema de integraciones y marketplace sectorial que aumenta retención enterprise.

---

## Estado de implementación en código (2026-10-26)

Leyenda: **Done** = scaffolding/UI/API/migración listos en repo · **Partial** = código usable pero falta wiring de producción o datos reales · **Blocked-external** = no cerrable solo con código (clientes, dinero live, auditoría SOC2, etc.).

### Hito 1 — MVP comercial

| Entregable | Estado | Notas |
|------------|--------|-------|
| Auth producción + redirects | Done | Dual-mode demo + Supabase; `auth/callback` recovery→`/nueva-contrasena`; checklist UI en `/dashboard/seguridad` vía `/api/health` |
| Resend live / Stripe live | Blocked-external | Código + reintentos; requiere keys live y dominio |
| Happy path wizard + onboarding | Done | `HappyPathWizard` + checklist en dashboard |
| Legal DPA / Soporte / Estado | Done | `/dpa`, `/soporte` (mailto + ticket ID), footer + `/estado` |
| Analytics funnel stub | Done | `src/lib/analytics.ts` + buffer local + `/admin/analytics` + `mc_analytics_events` |

### Hito 2 — PMF

| Entregable | Estado | Notas |
|------------|--------|-------|
| News search adapter + API | Done | Demo + Tavily/Brave si hay keys; `POST /api/news/search`; botón en editor de boletín |
| Retries de envío Resend | Done | 2 reintentos + status `failed`; alertas `recordActivity` + notification store |
| NPS widget | Done | Dashboard + `mc_nps_responses`; media en `/admin/analytics` |
| Add-ons asientos/envíos | Done | UI + Checkout si hay Price IDs; demo purchase → `menoska_quota_overrides` + cuotas efectivas |
| Design partners admin | Done | `/dashboard/design-partners` local store |

### Hito 3 — Escala

| Entregable | Estado | Notas |
|------------|--------|-------|
| API v1 + webhooks CRUD + HMAC | Done | `/api/v1`, `/api/v1/webhooks`, UI `/dashboard/integraciones`, `sign.ts` |
| API keys (`mk_…`) | Done | Migración `mc_api_keys`, `/api/v1/keys`, Bearer solo en `/api/v1/*` |
| Packs sectoriales | Done | `/dashboard/packs` + `catalog.ts` |
| SSO UI + SCIM stub | Partial | Stub config + SCIM 501; SSO real Blocked-external |
| SIEM CSV audit export | Done | `/api/admin/audit/export` |
| Tests multi-tenant / plan guard | Done | `rbac.test.ts`, isolation bulletins, webhook sign + api-key hash |
| SOC 2 | Blocked-external | — |

### Hito 4 — Plataforma

| Entregable | Estado | Notas |
|------------|--------|-------|
| Benchmarks demo + opt-in | Done | `mc_benchmarks` + `/dashboard/benchmarks` |
| Partner portal | Done | `/partners` + `/dashboard/partners` referral stub |
| Investment memo agent HITL | Done | Form + Approve auto-link a proyecto + `/api/agents/investment-memo` |
| ISO / SOC 2 Type II / US-LATAM | Blocked-external | — |

### Hito 5 — Categoría

| Entregable | Estado | Notas |
|------------|--------|-------|
| Narrativa Innovation Capital OS | Done | `/innovation-capital-os` |
| PLG TAM calculator | Done | `/demo-tam` sin login |
| ARR cockpit mock | Done | `/admin/arr` desde `orgs-repository` cuando hay orgs; etiquetado mock |
| ARR / NRR reales | Blocked-external | — |

---

*Documento vivo. Actualizar entregables y métricas cuando existan datos reales de producción; no sustituir hechos por proyecciones en materiales comerciales.*
