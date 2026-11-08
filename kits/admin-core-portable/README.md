# Kit portable — Admin general

Panel de administración reutilizable de Proposalyze: superadmin, empleados con permisos, calendario, documentos internos, finanzas y CRM.

Quedan fuera convocatorias, resoluciones, partners, memorias, recompensas de créditos y el agente comercial. El AI SDR tiene su propio kit en `kits/ai-sdr-portable`.

## Contenido

| Ruta | Qué es |
|---|---|
| `PROMPT_MAESTRO.md` | Prompt para pegar en el agente del proyecto destino |
| `SCOPE.md` | Qué módulos entran y cómo se comportan |
| `CHECKLIST.md` | Lista de comprobación al terminar |
| `01-database/migration.sql` | Esquema, RLS y RPC de staff, calendario, documentos, gastos y CRM |
| `01-database/ADAPT.md` | Roles, lista blanca de permisos y qué no reaplicar |
| `01-database/origin-crm/` | Funciones de catálogo de empresas, como referencia |
| `02-frontend/FILE_MAP.md` | Archivos del repo origen que hay que copiar |
| `02-frontend/ADAPT_IMPORTS.md` | Alias, recorte de RBAC y de tipos |

## Cómo usarlo

1. Copia la carpeta `kits/admin-core-portable` al otro repo, o déjala abierta junto a ese workspace.
2. Abre `PROMPT_MAESTRO.md` y pega el bloque al agente del destino.
3. Indica la marca y qué módulos quieres. Ejemplo: `BRAND=Astoha`, blog no, Stripe sí.
4. Si este repo no está en el mismo workspace, pasa la ruta absoluta de Menoska Consulting para que el agente lea las pantallas listadas en `FILE_MAP.md`.

El SQL del kit ya basta para crear las tablas. Las pantallas hay que copiarlas del origen y adaptarlas: el kit no duplica esos componentes para que no se queden viejos.
