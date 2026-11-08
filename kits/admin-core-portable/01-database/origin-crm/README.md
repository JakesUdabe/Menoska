# Snapshots del CRM de empresas

Copias literales de las migraciones de origen. Sirven para sacar las funciones de catálogo y asignación. La tabla `crm_company_requests` y sus policies ya están en `../migration.sql`.

Orden de lectura:

1. `20260929210000_crm_company_requests.sql` — clave de empresa, solicitar, resolver, asignar.
2. `20260929220000_crm_company_catalog.sql` — listado y búsqueda del catálogo.
3. `20261009230000_fix_crm_catalog_owner_id_ambiguous.sql` — reemplaza las funciones del catálogo que tenían `owner_id` ambiguo. Esta versión manda.

Al implantar, aplica las funciones de (3) cuando pisen a las de (2). Salta cualquier `CREATE TABLE` o `CREATE POLICY` que ya haya ejecutado `migration.sql`.

Si una función lee tablas de resoluciones, outreach o sales, déjala fuera. Esas tablas no forman parte de este kit.
