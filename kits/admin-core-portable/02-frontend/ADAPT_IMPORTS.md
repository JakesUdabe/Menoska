# Adaptar imports y UI

Origen: React, Tailwind, shadcn, lucide-react, sonner, date-fns, i18next, React Router dentro del dashboard.

## Alias que hay que reescribir

| Import de origen | Sustituto |
|---|---|
| `@dashboard/integrations/supabase/client` | Cliente Supabase del destino |
| `@/integrations/supabase/client` | El mismo cliente |
| `@dashboard/contexts/AuthContext` | Auth del destino, con el contrato de `FILE_MAP.md` |
| `@dashboard/components/ui/*` | Los mismos primitivos shadcn si existen; si no, el equivalente del design system |
| `@dashboard/lib/utils` (`cn`) | Helper `cn` del destino |
| `@dashboard/lib/rbac` | La copia adaptada de `rbac.ts` |
| `@dashboard/hooks/useAdminData` | La copia de `useAdminData.ts` |
| `@dashboard/types/admin` | Tipos recortados |
| `@dashboard/lib/plan` (`normalizePlanType`) | Quítalo si el destino no tiene planes free/pro/business |
| `@/lib/seo` (`SITE_URL`) | URL pública del destino, solo la usa el blog |
| `@/components/LegalFooter` | Footer legal del destino, o quita el footer del layout |

## Recorte de `rbac.ts`

Deja estos módulos, en este orden de menú:

`crm`, `finanzas`, `calendario`, `documentos`, `blog`, `empleados`.

Quita `convocatorias`, `resoluciones`, `partners`.

Quita `unlimited_ia` salvo que el destino tenga un bypass de créditos equivalente y lo pidas aparte.

`hasModuleAccess`:

- `admin` entra en todos los módulos.
- `empleado` entra si `employee_permissions[modulo] === true`.
- `empleados` devuelve false para cualquiera que no sea `admin`.
- El atajo de origen «partners si tiene resoluciones» no se porta.

`getDefaultAdminRoute` sigue mandando al primer módulo permitido. Si no hay ninguno, manda al home autenticado del destino (en origen es `/dashboard`).

## Recorte de `types/admin.ts`

Quédate con fichaje, ausencias, festivos, gastos, leads, actividades, playbook, incidencias, documentos y `StaffProfile`.

Quita `CreditReward`, `FeatureAccessReward`, `CrmRewardKind`, `FeatureAccessModule` y los snapshots de memorias.

`CrmPlanMonthlySnapshot` solo si vas a pintar la pestaña de métricas de planes.

`CrmSource` puede conservar `ai_sdr` y `resoluciones_prospeccion` como valores de la columna, para no romper el `CHECK` de `migration.sql`. La UI del destino no tiene por qué ofrecerlos en el selector si esos flujos no existen.

## Recorte de `AdminLayout.tsx`

`MODULE_ICONS` solo para los módulos que queden en `ADMIN_MODULES`.

El enlace «Volver al dashboard» debe apuntar al home autenticado del destino.

El badge de rol usa `admin.roles.admin` = Superadmin y `admin.roles.empleado` = Empleado.

## Router

`AdminRoute` envuelve el layout. Cada página cuelga de `RoleRoute` con su `module`.

`/admin` renderiza `AdminIndexRedirect`.

Si el destino es Next.js o TanStack puro, traduce `Route` / `Link` / `Navigate` / `useLocation` de react-router-dom. No dejes los dos routers a la vez si el destino no los usa.

## Marca y textos

Sustituye `Proposalyze` y el autor por defecto del blog (`Proposalyze Team`) por `{{BRAND}}`.

Las claves i18n se quedan en `admin.*`. Fusiona, no reemplaces el JSON entero del destino.

## Edge Functions

`invokeAdminFunction(name, fallback, body)` hace `supabase.functions.invoke`. El cuerpo de error útil está en `data.error` o en el JSON del `FunctionsHttpError`.

Secrets que esas functions esperan en origen, y que solo hacen falta si montas la pieza:

| Function | Secrets |
|---|---|
| `get-stripe-financials` | `STRIPE_SECRET_KEY` |
| `sync-openai-costs` | `OPENAI_ADMIN_KEY` (o la key de costes que use el origen; léela antes de inventar el nombre) |
| newsletter / blog draft | `RESEND_API_KEY` o el proveedor de correo del origen, `OPENAI_API_KEY`, URL pública |

Lee cada `index.ts` antes de desplegar. No inventes el contrato del webhook ni la forma del gasto OpenAI.
