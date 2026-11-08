# Adaptar la base al proyecto destino

`migration.sql` es el contrato portable. Está tomado de la forma viva de Proposalyze (noviembre 2026), recortado a lo general.

## Antes de aplicarlo

1. Confirma que existe `public.profiles` con `user_id`, `role`, `full_name`, `company_name`, `created_at`, `updated_at`.
2. Confirma los tres roles. Por defecto el kit usa:
   - superadmin: `admin`
   - staff con permisos: `empleado`
   - usuario normal, al quitar el rol de empleado: `cliente`
3. Si el destino ya tiene otra convención (`owner`, `member`, `user`), cambia esas literales en las funciones y en `src` de RBAC a la vez. No dejes la UI en `admin` y la SQL en `owner`.
4. Si `profiles.role` tiene un `CHECK` que no admite `empleado`, amplíalo antes de promover a nadie.

## Lista blanca de permisos

La única lista que persiste en base es `sanitize_employee_permissions`.

Keys de este kit: `calendario`, `finanzas`, `crm`, `documentos`, `blog`.

`empleados` no es un permiso de empleado. Solo `role = admin` abre esa pantalla.

Si activas o quitas un módulo:

1. Añade o quita la key en `sanitize_employee_permissions`.
2. Añádela en `EMPLOYEE_ASSIGNABLE_PERMISSIONS` del frontend.
3. Vuelve a crear la función y vuelve a guardar los permisos de cada empleado (un JSON antiguo no gana keys nuevas solo por existir en la UI).

En el origen, `set_user_as_employee` y `update_employee_permissions` tiran `blog` y `resoluciones` aunque la pantalla los muestre. El kit corrige eso para los módulos que sí viajan. No copies esas dos funciones viejas encima de `migration.sql`.

## Qué no está en migration.sql

| Pieza | Dónde está | Cuándo aplicarla |
|---|---|---|
| Catálogo de empresas, asignación y solicitudes | `01-database/origin-crm/*.sql` | Solo si montas las pestañas de catálogo / solicitudes del CRM |
| Blog + newsletter | migraciones `20260810*` y `20260811*` del origen | Solo si montas Blog |
| Ingresos Stripe | Edge `get-stripe-financials` | Solo si el destino cobra con Stripe |
| Sync de costes OpenAI | Edge `sync-openai-costs` | Solo si quieres el proveedor `openai` automático |
| Snapshots de planes y memorias | `crm_plan_monthly_snapshots`, `crm_memoria_monthly_snapshots` | No. Son métricas de Proposalyze |

Los SQL de `origin-crm/` también crean `crm_company_requests` y sus policies. `migration.sql` ya crea esa tabla. Al aplicar los snapshots, quédate con las funciones (`crm_lead_company_key`, `crm_assign_company_to_comercial`, `crm_request_company`, `crm_resolve_company_request`, `crm_list_companies_catalog` y las que el fix posterior reemplaza). No vuelvas a crear la tabla ni las policies.

Esas funciones de catálogo mencionan dominio de correo, CIF y comerciales. Revísalas: si una referencia una tabla de resoluciones o de outreach, no la copies.

## RLS que hay que conservar

- Calendario: cada persona ve y ficha lo suyo. El superadmin ve el fichaje de todos y aprueba ausencias. Un empleado con permiso `calendario` no ve el fichaje de los demás.
- Festivos: los lee cualquier staff; los escribe el superadmin.
- Documentos, gastos, leads, actividades, playbook, incidencias y cadencia: `has_admin_module_access` del módulo.
- Solicitudes de empresa: el empleado inserta las suyas en `pending`; el superadmin las lee todas y las resuelve.
- Las RPC de empleados comprueban `is_super_admin()` por dentro. Son `SECURITY DEFINER`. No las abras a `anon`.

## Trigger de convertido

`crm_clear_proximo_when_converted` deja `proximo_contacto` a null cuando `fase = convertido` o `is_converted` es true. En origen eso era un arreglo de datos, no un trigger. El kit lo deja como regla para que el pipeline no siga persiguiendo a un cliente ya convertido. La fase y el flag no se reescriben entre sí.
