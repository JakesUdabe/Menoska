# Mapa de archivos a copiar

Rutas relativas a la raíz de **Menoska Consulting** (Proposalyze). Copia el archivo y adapta imports según `ADAPT_IMPORTS.md`. El comportamiento de referencia es el de estos archivos, recortado por `SCOPE.md`.

Si el repo origen no está en el workspace destino, pide la ruta absoluta y lee desde ahí. No reescribas las pantallas de cero mientras esos archivos se puedan leer.

## Shell y acceso

| Origen | Para qué |
|---|---|
| `src/dashboard/components/AdminLayout.tsx` | Sidebar, cabecera, logout, badge de rol |
| `src/dashboard/components/AdminRoute.tsx` | Gate de sesión staff |
| `src/dashboard/components/RoleRoute.tsx` | Gate por módulo |
| `src/dashboard/pages/admin/AdminIndexRedirect.tsx` | `/admin` → primer módulo permitido |
| `src/dashboard/lib/rbac.ts` | Roles, módulos, permisos de empleado |
| `src/dashboard/hooks/useAdminData.ts` | Staff, usuario objetivo del calendario, `invokeAdminFunction` |
| `src/dashboard/types/admin.ts` | Tipos de fichaje, gastos, leads, documentos |
| `src/dashboard/DashboardAppRoutes.tsx` | Solo el bloque `<Route path="/admin">` y sus hijos |

En origen el router exterior es TanStack (`src/routes/admin.tsx`, `admin.index.tsx`, `admin.$.tsx`) y el interior es React Router dentro de `DashboardShell`. En el destino monta el layout con el router que ya exista. Conserva las rutas:

- `/admin`
- `/admin/calendario`
- `/admin/finanzas`
- `/admin/crm`
- `/admin/documentos`
- `/admin/blog` (opcional)
- `/admin/empleados`

## Pantallas que sí viajan

| Origen | Módulo |
|---|---|
| `src/dashboard/pages/admin/AdminCalendarioPage.tsx` | Calendario |
| `src/dashboard/lib/time-utils.ts` | Horas, semana, festivos |
| `src/dashboard/pages/admin/AdminDocumentosPage.tsx` | Documentos |
| `src/dashboard/pages/admin/AdminEmpleadosPage.tsx` | Superadmin / empleados |
| `src/dashboard/pages/admin/AdminFinanzasPage.tsx` | Finanzas |
| `src/dashboard/pages/admin/AdminCrmPage.tsx` | CRM. Quita pestañas de `SCOPE.md` |
| `src/dashboard/pages/admin/CrmPipelinePanel.tsx` | Pipeline |
| `src/dashboard/pages/admin/CrmPlaybookPanel.tsx` | Playbook |
| `src/dashboard/pages/admin/CrmLeadWorkbench.tsx` | Ficha del lead |
| `src/dashboard/lib/crmCommercial.ts` | Agrupación por empresa, urgencia, dominios |
| `src/dashboard/pages/admin/CrmCompanyRequestCatalog.tsx` | Catálogo. Opcional |
| `src/dashboard/pages/admin/CrmCompanyRequestsPanel.tsx` | Solicitudes. Opcional |
| `src/dashboard/lib/crmCompanyAccess.ts` | Acceso por empresa. Opcional |

## Opcionales

| Origen | Cuándo |
|---|---|
| `src/dashboard/pages/admin/CrmDashboardPanel.tsx` | Solo los contadores que el destino pueda alimentar. Quita memorias y deliverability de outreach |
| `src/dashboard/pages/admin/AdminBlogPage.tsx` | Si hay blog |
| `src/dashboard/pages/admin/AdminNewsletterPanel.tsx` | Si hay newsletter |
| `src/lib/blog.ts`, `src/lib/blogHtml.ts`, `src/lib/blogDb.ts` | CMS |
| `src/dashboard/components/HtmlContentEditor.tsx` | Editor del post |
| `supabase/functions/get-stripe-financials` | Ingresos del año |
| `supabase/functions/sync-openai-costs` | Gastos OpenAI → `expenses` |
| `supabase/functions/generate-blog-draft` | Borrador con LLM |
| `supabase/functions/prepare-blog-digest`, `send-blog-newsletter` | Envío |
| `supabase/functions/newsletter-subscribe`, `newsletter-confirm`, `newsletter-unsubscribe` | Alta pública |
| `supabase/functions/_shared/email.ts`, `_shared/newsletter.ts` | Dependencias de esas functions |

## Fuera del kit

No copies estos archivos ni sus tablas:

- `AdminConvocatoriasPage.tsx`
- `AdminResolucionesPage.tsx`
- `AdminPartnersPage.tsx`
- `CrmRewardPanel.tsx` (créditos y acceso a resoluciones/partners)
- `src/dashboard/pages/admin/ai-sdr/**` — kit aparte: `kits/ai-sdr-portable`
- `src/dashboard/pages/admin/agente-comercial/**`
- Edge functions de memorias, convocatorias, evaluador, redacción, partners

`CrmPipelinePanel.tsx` importa tipos de `agente-comercial`. Al copiarlo, sustituye ese import por un tipo local mínimo o elimina el trozo que abre el agente comercial. El pipeline de fases, seguimientos y playbook se queda.

## i18n

Claves en `src/dashboard/i18n/locales/{es,en,eu,gl,ca}.json`, objeto `admin`.

Copia:

- `sessionClosed`, `backToDashboard`, `logout`, `adminMode`, `brand`, `brandAdmin`, `staff`
- `modules` (solo los módulos que montes)
- `roles`, `common`
- `expenseCategories`, `expenseProviders`, `leadPhases`, `absenceTypes`, `incidentStatuses`, `incidentPriorities`
- `documentos`, `empleados`, `finanzas`, `calendario`
- `crm`, salvo subárboles de reward, AI SDR y agente comercial
- `blog`, si montas blog

`brand` en origen es `Proposalyze`. Cámbialo por la marca del destino.

## Contrato de auth que las pantallas esperan

`useAuth()` devuelve `session`, `user`, `profile`, `loading`, `profileLoading`, `signOut`.

`profile` incluye `role`, `employee_permissions`, `full_name`.

El cliente Supabase del dashboard está en `@dashboard/integrations/supabase/client`. El blog usa `@/integrations/supabase/client`. En el destino unifica ambos al cliente que ya exista.
