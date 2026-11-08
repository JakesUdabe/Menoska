# PROMPT MAESTRO — Implantar el admin general

Copia **todo** el bloque siguiente en un chat de Cursor del **proyecto destino**. Adjunta la carpeta `kits/admin-core-portable/` (en el repo, o pegada en el destino). Si puedes, abre también el repo origen Menoska Consulting para copiar las pantallas.

Sustituye los valores de la primera línea antes de pegarlo.

---

```
Actúa como Senior Full-Stack Engineer. Implanta en ESTE repositorio el módulo portable "Admin general" (shell, superadmin, calendario, documentos, finanzas, CRM).

Parámetros:
- BRAND: {{BRAND}}
- ORIGIN_REPO: {{ruta absoluta de Menoska Consulting, o "adjunto en kits/admin-core-portable"}}
- Módulos: empleados, calendario, documentos, finanzas, crm. Blog: {{sí|no}}. Catálogo de empresas del CRM: {{sí|no}}. Stripe: {{sí|no}}. Sync de costes OpenAI: {{sí|no}}.

Fuente de verdad, en este orden:
1. kits/admin-core-portable/SCOPE.md
2. kits/admin-core-portable/01-database/migration.sql y ADAPT.md
3. kits/admin-core-portable/02-frontend/FILE_MAP.md y ADAPT_IMPORTS.md
4. Los archivos de ORIGIN_REPO listados en FILE_MAP.md. Cópialos y adáptalos. No reescribas las pantallas de cero si puedes leerlas.

## Objetivo
Un área /admin para el equipo interno:
- Superadmin (role admin) entra en todo y gestiona empleados.
- Empleado (role empleado) solo ve los módulos marcados en employee_permissions.
- Calendario: fichaje, ausencias, festivos, horas esperadas 8/40 descontando festivos.
- Documentos: enlaces internos agrupados por sección.
- Finanzas: gastos y cuenta de resultados (EBITDA → EBIT → EBT → neto). Ingresos Stripe solo si el parámetro Stripe es sí.
- CRM: directorio de leads, pipeline con cadencia, incidencias. Catálogo de empresas solo si el parámetro es sí.

## Fuera de alcance
No portes convocatorias, resoluciones, partners, recompensas de créditos, métricas de memorias, agente comercial ni AI SDR.
No copies AdminConvocatoriasPage, AdminResolucionesPage, AdminPartnersPage, CrmRewardPanel, ai-sdr/** ni agente-comercial/**.
Si el destino quiere AI SDR, se hace después con kits/ai-sdr-portable. En este paso la pestaña ai-sdr no existe.
No añadas módulos que el destino no haya pedido.

## Paso 0 — Descubrir el destino
Antes de escribir código:
- Framework, router, cliente de Supabase, carpeta de UI, i18n, layout autenticado.
- Cómo se llama hoy el rol de administrador y el de usuario normal.
- Si profiles ya existe y qué columnas tiene.
Escribe esas diferencias y luego aplica el kit. Si el rol de superadmin del destino no es "admin", cámbialo en migration.sql y en rbac.ts a la vez.

## Paso 1 — Base de datos
- Aplica 01-database/migration.sql.
- Lee ADAPT.md. La lista blanca que persiste es sanitize_employee_permissions. Tiene que listar exactamente los módulos que montes, incluido blog solo si el parámetro es sí.
- Si Catálogo de empresas es sí, toma las funciones de 01-database/origin-crm/ en el orden del README de esa carpeta. No recrees crm_company_requests ni sus policies. Descarta cualquier función que lea tablas de resoluciones, outreach o sales.
- Regenera los tipos TypeScript de las tablas y RPC nuevas.
- No apliques el resto de migraciones de Proposalyze.

## Paso 2 — Shell y RBAC
- Copia AdminLayout, AdminRoute, RoleRoute, AdminIndexRedirect, rbac.ts, useAdminData.ts.
- Reescribe imports según ADAPT_IMPORTS.md.
- ADMIN_MODULES, en este orden, solo con los módulos activos: crm, finanzas, calendario, documentos, blog, empleados.
- admin entra en todo. empleado entra si el permiso está a true. empleados solo lo abre admin.
- Quita el atajo partners ← resoluciones y la key unlimited_ia.
- Monta las rutas /admin y /admin/<modulo> con RoleRoute.
- /admin redirige al primer módulo permitido.
- Marca visible: {{BRAND}}. Enlace de vuelta al home autenticado del destino.

## Paso 3 — Pantallas
Copia las páginas de FILE_MAP.md que correspondan a los módulos activos.
- Calendario: usa time-utils.ts. El selector de persona solo lo usa el superadmin. No aflojes la RLS para que un empleado vea fichajes ajenos.
- Documentos: CRUD de admin_documents agrupado por sección.
- Empleados: RPC list_employee_profiles, search_users_for_employee, set_user_as_employee, update_employee_permissions, update_employee_commercial_identity, demote_employee_to_cliente. La URL de calendario tiene que ser https o vacía.
- Finanzas: gastos y la cascada EBITDA. Si Stripe es no, no llames a get-stripe-financials y no bloquees la página por ello. Si OpenAI es no, oculta el botón de sync.
- CRM: pestañas Leads, Pipeline, Incidencias. Éxito/clientes solo si el destino tiene usuarios con rol de cliente y planes que quieras mostrar; si los planes no son free/pro/business, adapta los badges o quita la pestaña. Quita reward, ai-sdr y cualquier import de agente-comercial. En CrmPipelinePanel sustituye el tipo SalesStartup por lo mínimo que el panel aún necesite, o elimina ese bloque.
- Blog, solo si el parámetro es sí: copia AdminBlogPage, newsletter, blog.ts / blogHtml / blogDb y el editor HTML. Autor por defecto: equipo de {{BRAND}}.

## Paso 4 — i18n
Fusiona las claves admin.* listadas en FILE_MAP.md en los idiomas que el destino ya tenga. Origen de referencia: src/dashboard/i18n/locales/es.json (y en, eu, gl, ca si el destino los usa). admin.brand = {{BRAND}}.

## Paso 5 — Edge Functions, solo las pedidas
- Stripe sí: copia supabase/functions/get-stripe-financials y sus _shared, despliega, documenta el secret.
- OpenAI sí: copia sync-openai-costs. Lee el nombre real del secret en el código origen. No lo inventes.
- Blog sí: copia las functions de newsletter y generate-blog-draft que FILE_MAP lista, más _shared/email.ts y _shared/newsletter.ts. Adapta remitente y dominio a {{BRAND}}.

## Reglas
- Cambios mínimos, con los patrones del destino (alias, UI, auth).
- No relajes RLS para que la UI "funcione" con el anon key.
- No dejes toggles de permiso que la SQL tire al guardar. Si la UI tiene una key, sanitize_employee_permissions también.
- No copies secretos ni .env.
- Al terminar, lista archivos creados, módulos omitidos, adaptaciones de roles/imports y secrets pendientes.
- Recorre CHECKLIST.md y marca lo que hayas verificado de verdad.

## Hecho cuando
- Un admin abre /admin y ve solo los módulos acordados.
- Un empleado con un solo permiso no ve el resto y no puede abrir /admin/empleados.
- Fichaje, documento, gasto y lead se crean y vuelven a leerse con la sesión de esa persona.
- Un lead convertido queda con proximo_contacto vacío.
- El build del destino pasa.
```

---

## Uso rápido

1. Copia `kits/admin-core-portable` al otro proyecto o mantenla visible en el workspace.
2. Rellena `BRAND`, `ORIGIN_REPO` y los sí/no.
3. Pega el bloque.
4. Cuando el CRM esté estable, el AI SDR se implanta aparte con `kits/ai-sdr-portable`, si hace falta.
