# Checklist de implantación

## Descubrimiento

- [x] Stack del destino anotado: router, cliente Supabase, UI, i18n, ruta del área autenticada
- [x] Roles reales alineados con `admin` / `empleado` / `cliente`, o sustituidos en SQL y en `rbac.ts` a la vez
- [x] Módulos elegidos (mínimo: empleados, calendario, documentos, CRM, finanzas; blog sí o no)

## Base

- [x] `01-database/migration.sql` aplicada
- [x] `sanitize_employee_permissions` coincide con los toggles de la pantalla Empleados
- [ ] Un usuario `role = admin` de prueba entra al panel
- [x] Funciones de `origin-crm/` aplicadas solo si hay catálogo de empresas, sin recrear la tabla

## Frontend

- [x] Layout, `AdminRoute`, `RoleRoute` y redirect de `/admin`
- [x] Páginas copiadas desde `02-frontend/FILE_MAP.md` y imports reescritos
- [x] `rbac.ts` sin convocatorias, resoluciones ni partners
- [x] CRM sin pestañas de reward, AI SDR ni agente comercial
- [x] `CrmPipelinePanel` ya no importa `agente-comercial`
- [x] i18n fusionada y `admin.brand` con la marca del destino
- [ ] Empleado de prueba: con un solo módulo activo ve solo ese ítem; `/admin/empleados` lo expulsa

## Opcionales

- [x] Stripe: `get-stripe-financials` desplegada, o ingresos desactivados en la UI
- [x] OpenAI costs: sync desplegado, o el botón oculto
- [ ] Blog y newsletter, con secrets de correo, solo si se eligió el módulo

## Prueba corta

- [ ] Superadmin ficha, crea un festivo, aprueba una ausencia
- [ ] Empleado ficha y no ve el fichaje de otra persona (respuesta vacía de Supabase, no solo UI)
- [ ] Alta de documento en una sección y edición
- [ ] Alta de gasto y que el EBITDA del año lo cuente
- [ ] Alta de lead, cambio de fase, registro de contacto y `proximo_contacto` calculado
- [x] Lead pasado a convertido y `proximo_contacto` a null
- [ ] Promover un usuario a empleado, activar solo `documentos`, entrar con esa cuenta
