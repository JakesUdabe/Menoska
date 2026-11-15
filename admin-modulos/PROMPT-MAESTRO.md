# Prompt maestro — módulo admin (Clientes, Finanzas, Calendario, Documentos, Empleados)

Copia la carpeta `admin-modulos` a la raíz del otro proyecto y pega el bloque de abajo en el agente de ese proyecto.

---

Actúa en este repositorio. La carpeta `admin-modulos` es un módulo de administración ya escrito. Intégralo. No reescribas la lógica de negocio, no rediseñes las pantallas y no sustituyas las consultas por otras “equivalentes”.

El módulo son cinco pantallas:

- Clientes → `src/dashboard/pages/admin/AdminCrmPage.tsx` (ruta `/admin/crm`)
- Finanzas → `AdminFinanzasPage.tsx` (`/admin/finanzas`)
- Calendario → `AdminCalendarioPage.tsx` (`/admin/calendario`)
- Documentos → `AdminDocumentosPage.tsx` (`/admin/documentos`)
- Empleados → `AdminEmpleadosPage.tsx` (`/admin/empleados`)

## 1. Inspecciona el destino antes de tocar nada

Localiza:

- el alias de imports del dashboard (en origen es `@dashboard/*` → `src/dashboard/*`)
- el cliente de Supabase
- el `AuthContext` (`useAuth`)
- el router (rutas admin existentes)
- los JSON de i18n
- si ya hay tablas `profiles`, `crm_leads`, `expenses`, `time_entries`

Si el destino no usa `@dashboard`, reescribe solo los imports de los archivos copiados para que apunten a los mismos sitios de este proyecto. Conserva los nombres de archivo.

## 2. Copia el código

Copia el contenido de `admin-modulos/src/dashboard/` encima del dashboard de este proyecto (el directorio que el alias resuelve).

Archivos que tienen que quedar:

- `pages/admin/AdminCrmPage.tsx`, `AdminFinanzasPage.tsx`, `AdminCalendarioPage.tsx`, `AdminDocumentosPage.tsx`, `AdminEmpleadosPage.tsx`
- `pages/admin/CrmRewardPanel.tsx`, `CrmPipelinePanel.tsx`, `CrmLeadWorkbench.tsx`, `CrmPlaybookPanel.tsx`, `CrmDashboardPanel.tsx`, `CrmCompanyRequestCatalog.tsx`, `CrmCompanyRequestsPanel.tsx`
- `pages/admin/ai-sdr/` (panel, `api.ts`, `types.ts`)
- `pages/admin/agente-comercial/` (`api.ts`, `leadPriority.ts`, `salesDb.ts`, `types.ts`, `startups.ts`)
- `lib/rbac.ts`, `lib/crmCommercial.ts`, `lib/crmCompanyAccess.ts`, `lib/time-utils.ts`, `lib/plan.ts`
- `hooks/useAdminData.ts`
- `types/admin.ts`
- `components/RoleRoute.tsx`

Si `rbac.ts`, `plan.ts` o `types/admin.ts` ya existen, no los machaques a ciegas. Fusiona: este módulo necesita los tipos y helpers de CRM, gastos, ausencias, festivos y documentos, y las funciones `hasModuleAccess`, `isSuperAdmin`, `getDefaultAdminRoute`, `EMPLOYEE_ASSIGNABLE_PERMISSIONS`, `MODULE_ROUTES`.

Contrato que el código ya importa. Créalos si no existen, con la misma forma:

- `supabase` exportado desde el cliente (`@dashboard/integrations/supabase/client` en origen).
- `cn` en `@dashboard/lib/utils`.
- `useAuth()` devuelve `{ user: { id: string } | null, profile, profileLoading, signOut }`.
- `profile` tiene `role` (`"admin"` | `"empleado"` | rol de cliente) y `employee_permissions` (objeto de booleanos).
- Componentes shadcn ya montados: `button`, `card`, `badge`, `tabs`, `table`, `dialog`, `input`, `label`, `textarea`, `select`, `switch`, `checkbox`, `sheet`, `collapsible`.
- Dependencias: `react-router-dom`, `react-i18next`, `sonner`, `lucide-react`, `date-fns` (locales `es`, `enUS`, `eu`, `gl`, `ca`).

`CrmLeadWorkbench.tsx` importa `TablesInsert` desde `@/integrations/supabase/types` solo como cast del insert de `crm_leads`. Cuando el tipado de Supabase de este proyecto no tenga esa tabla, quita el cast y deja el objeto plano. No bloquees la integración por eso.

En `pages/admin/agente-comercial/startups.ts` sustituye marca, dominio, tono y propuesta de valor por los de ESTE producto. El resto de la función se queda.

## 3. Base de datos

Aplica `admin-modulos/supabase/schema.sql` en el Postgres de este proyecto (migración nueva o SQL editor). Es idempotente.

Antes de aplicarlo confirma que `public.profiles` usa `user_id uuid` apuntando a `auth.users`. Si la clave se llama de otra forma, adapta el SQL y las consultas `.eq("user_id", ...)` de los archivos copiados a esa clave. No inventes una segunda tabla de perfiles.

El rol de superadmin es `admin`. El rol con permisos por módulo es `empleado`. `demote_employee_to_cliente` deja el rol en `cliente`. Si aquí el usuario normal tiene otro nombre de rol, cambia solo esa cadena.

La policy `"Staff can view staff profiles"` es aditiva: el staff lee fichas de admin y empleado. No borres las policies de `profiles` que ya existan.

Si el aviso `crm_leads tiene emails duplicados` sale al crear el índice único, deduplica por `lower(email)` y vuelve a crear `crm_leads_email_lower_uidx`.

Regenera los tipos de Supabase después del SQL.

## 4. Textos

Haz un merge profundo de cada `admin-modulos/i18n/<locale>.json` dentro del JSON de ese idioma, bajo la clave `admin`. No reemplaces el objeto `admin` entero si el destino ya tiene otras pantallas. Cambia `admin.brand` al nombre de este producto.

Las pantallas usan `t("admin....")`. Hace falta `admin.convocatoriasPage.emDash` (vale con `"—"`).

## 5. Rutas y menú

Monta las cinco rutas dentro del layout admin, cada una envuelta en `RoleRoute`:

```tsx
<Route path="calendario" element={<RoleRoute module="calendario"><AdminCalendarioPage /></RoleRoute>} />
<Route path="finanzas" element={<RoleRoute module="finanzas"><AdminFinanzasPage /></RoleRoute>} />
<Route path="crm" element={<RoleRoute module="crm"><AdminCrmPage /></RoleRoute>} />
<Route path="documentos" element={<RoleRoute module="documentos"><AdminDocumentosPage /></RoleRoute>} />
<Route path="empleados" element={<RoleRoute module="empleados"><AdminEmpleadosPage /></RoleRoute>} />
```

El menú sale de `getAccessibleModules(profile)` + `MODULE_ROUTES`. Iconos: crm `Users`, finanzas `DollarSign`, calendario `CalendarDays`, documentos `FolderOpen`, empleados `UserCog`. Etiquetas: `t("admin.modules.<modulo>")`.

`admin` ve todos los módulos. `empleado` solo ve los que tenga a `true` en `employee_permissions`. `empleados` es solo para `admin`.

Si este proyecto no tiene Convocatorias, Resoluciones, Partners ni Blog, recorta `ADMIN_MODULES` y `EMPLOYEE_ASSIGNABLE_PERMISSIONS` en `rbac.ts` a los módulos que sí montas. Las keys que quite el UI también hay que quitarlas de `public._employee_permissions_json` en el SQL, o el guardado de permisos las pisará a `false` y no pasa nada; el fallo es el contrario: una key en el UI que el SQL no persista. Mantén las dos listas iguales.

## 6. Qué funciona con solo el schema, y qué hay que recortar

Con el SQL de esta carpeta quedan operativos:

- Empleados (alta, permisos, ficha comercial, baja a cliente)
- Documentos (enlaces por sección)
- Calendario (fichaje, ausencias, festivos)
- Finanzas (gastos manuales, EBITDA por categorías)
- Clientes: pestañas Leads, Pipeline (playbook y seguimientos 3/7/14) e Incidencias

Estas partes del CRM llaman a backend de Proposalyze que este schema no crea. Si este producto no tiene ese backend, quítalas de `AdminCrmPage.tsx` para que la página cargue. No dejes llamadas que lancen error en el `Promise.all` inicial.

| Pieza | Qué exige | Si no existe aquí |
| --- | --- | --- |
| `crm_client_company_signals` y `list_crm_platform_clients` | usuarios de la plataforma y señales de empresa | En `fetchData`, no hagas `throw` si fallan. Carga leads e incidencias igual. Quita la pestaña Éxito. |
| Pestaña Dashboard (`CrmDashboardPanel`) | tablas `sales_*` y snapshots de planes/memorias | Quita la pestaña. |
| Pestaña AI SDR (`ai-sdr/`) | funciones `sdr-*` y tablas `sdr_leads` | Quita la pestaña. |
| Catálogo y solicitudes de empresa | RPCs `crm_list_companies_catalog`, `crm_request_company`, `crm_assign_company_to_comercial`, `crm_resolve_company_request` | Quita esas pestañas. `lookupCrmCompany` ya va en try/catch. |
| Pestaña Recompensas (`CrmRewardPanel`) | `credit_rewards`, `feature_access_rewards`, `create_credit_rewards` | Quita la pestaña. `search_cliente_profiles` sí está en el schema. |
| Botón de generar borrador en `CrmLeadWorkbench` | edge `sales-outreach-generate` y `sales_leads` | Quita el botón y el import de `generateDraftForCrmLead`. |

No portés ese backend “para que compile” si el producto no lo tiene.

## 7. Finanzas: Stripe y OpenAI (opcional)

Los gastos manuales no necesitan funciones. Los botones de ingresos Stripe y de sincronizar costes OpenAI sí:

- Copia `admin-modulos/supabase/functions/get-stripe-financials`, `sync-openai-costs` y `_shared/access.ts` + `_shared/openai.ts` a `supabase/functions/` del destino. Si `_shared/access.ts` ya existe, añade `hasFinanceAccess` sin borrar el resto.
- Secrets: `STRIPE_SECRET_KEY`. Para OpenAI: `OPENAI_ADMIN_API_KEY` (clave de admin de organización, no la key normal), `SUPABASE_SERVICE_ROLE_KEY`, y opcional `OPENAI_PROJECT_ID` y `OPENAI_EUR_USD_RATE` (por defecto 0.92).
- Despliega las dos funciones. El cliente las llama con `invokeAdminFunction`.

Si no vas a conectar Stripe ni OpenAI, oculta esos botones en `AdminFinanzasPage.tsx` y deja el CRUD de gastos.

## 8. Comprueba esto antes de darlo por integrado

1. Un usuario `role = 'admin'` entra en las cinco rutas y las ve en el menú.
2. Desde Empleados conviertes un usuario normal en `empleado` con solo `calendario` y `documentos`. Ese usuario entra en esas dos y no en Finanzas, Clientes ni Empleados.
3. Calendario: fichar entrada y salida, pedir una ausencia, y como admin aprobarla y crear un festivo.
4. Documentos: crear un enlace, editarlo y borrarlo.
5. Finanzas: alta de un gasto manual y que el total del año lo sume. Si desplegaste las funciones, el año de Stripe responde y la sync de OpenAI inserta filas `provider = 'openai'`.
6. Clientes: crear un lead, cambiarlo de fase, abrir el pipeline, registrar un seguimiento y crear una incidencia. Un email duplicado lo rechaza el índice.
7. Recarga con sesión de empleado y confirma que el menú no parpadea a otra ruta mientras `profileLoading` es true (`RoleRoute` espera al perfil).

No cambies pantallas, tablas ni políticas que no use este módulo. Al terminar, dime qué pestañas de Clientes quitaste y qué funciones dejaste sin desplegar.
