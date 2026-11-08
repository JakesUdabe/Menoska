# Alcance — qué viaja y qué se queda

Este kit porta el panel de administración **general** de Proposalyze. El producto de origen redacta y evalúa memorias de subvenciones. Eso no viaja.

## Entra

### Shell y superusuario

- Layout con sidebar según permisos, cabecera, idioma, cierre de sesión.
- Dos roles: `admin` (superadmin, entra en todo) y `empleado` (solo los módulos que el superadmin active).
- Pantalla Empleados, solo superadmin:
  - listar staff (`list_employee_profiles`, incluye admins)
  - buscar usuarios que aún no son staff y promoverlos (`search_users_for_employee`, `set_user_as_employee`)
  - toggles de permiso (`update_employee_permissions`)
  - nombre, cargo, email de trabajo y URL https de Cal.com/Calendly (`update_employee_commercial_identity`)
  - devolver a cliente (`demote_employee_to_cliente`)

### Calendario

Pestañas: registros de fichaje, calendario anual, festivos (superadmin), aprobaciones de ausencias (superadmin).

- Fichar entrada y salida sobre `time_entries`. Jornada esperada: 8 h al día, 40 h a la semana, descontando festivos (`time-utils.ts`).
- El superadmin elige a qué persona mira. El empleado solo se ve a sí mismo. Eso lo impone la RLS, no solo la UI.
- Ausencias: vacaciones, baja, maternidad, justificada, solicitud pendiente. Estados pending / approved / rejected.
- Festivos por fecha única. Cuentan como día sin jornada esperada.

### Documentos

Biblioteca interna de enlaces. Cada fila es título, URL y sección. Se agrupan por sección. No es el generador de memorias ni el almacenamiento de expedientes.

### Finanzas

Pestañas: dashboard, EBITDA, gastos.

- Gastos manuales y de proveedor (`manual`, `openai`, `hetzner`, `cloudflare`).
- Categorías de explotación: recurrente, nómina, puntual. Esas entran en EBITDA.
- Depreciación y amortización bajan de EBITDA a EBIT.
- Intereses bajan a EBT. Impuestos bajan al resultado.
- Ingresos: Edge `get-stripe-financials` con el año seleccionado. Si el destino no usa Stripe, deja el dashboard de ingresos vacío o sustitúyelo por la fuente real. Los gastos siguen funcionando solos.
- Sync OpenAI: opcional. Inserta filas en `expenses` con `provider = openai` y `external_id` para no duplicar.

### CRM núcleo

Pestañas que sí:

| Pestaña origen | Qué hace |
|---|---|
| Leads | Directorio por empresa o por contacto, búsqueda, filtro de comercial y fase, alta y edición, archivo |
| Pipeline | Fases nuevo → contactado → propuesta → negociación → perdido. Cadencia `followup_days` (3, 7, 14). Playbook. Al registrar un contacto sube `contact_count` y calcula `proximo_contacto` |
| Incidencias | Cliente, descripción, estado, prioridad |
| Catálogo y solicitudes | Opcional. Un comercial pide una empresa; el superadmin asigna o rechaza |
| Éxito / clientes de plataforma | Opcional. Lista usuarios con `role` de cliente. Los badges free/pro/business son de Proposalyze: mapea los planes del destino o quita la pestaña |

Fases: `nuevo`, `contactado`, `propuesta`, `negociacion`, `convertido`, `perdido`.

Convertido limpia `proximo_contacto` (trigger del kit).

Actividades: nota, email, linkedin, llamada, demo, seguimiento, post_demo.

La prioridad A/B/C sigue en la columna y en el índice. La UI de origen ya no la enseña como eje principal. No la resucites como feature nueva.

### Blog (opcional)

Pestañas: indicadores, posts (borrador / publicado, slug, HTML saneado), newsletter.

Es un CMS genérico. El contenido y la marca son del destino. El pipeline de «generar borrador con LLM» y el cron de newsletter solo se portan si el destino va a enviar correo de verdad.

## Se queda en Proposalyze

- Convocatorias, resoluciones, partners.
- Recompensas de créditos y de acceso a resoluciones o partners (`CrmRewardPanel`).
- Métricas de memorias redactadas o revisadas.
- Agente comercial y su base de startups.
- AI SDR. Si el destino también lo quiere, usa `kits/ai-sdr-portable` después de tener el CRM. La pestaña `ai-sdr` de `AdminCrmPage` no se copia en este paso.
- `unlimited_ia` (bypass de créditos del redactor y del evaluador).
- Permiso `partners` derivado de `resoluciones`.

## Orden de menú en el destino

`crm`, `finanzas`, `calendario`, `documentos`, `blog`, `empleados`.

Quita del array el módulo que decidas no montar. El primer elemento es la landing de `/admin` para quien pueda verlo.
