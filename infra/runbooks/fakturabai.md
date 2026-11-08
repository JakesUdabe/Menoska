# FakturaBAI — Menoska

El worker se construye desde `/opt/fakturabai` (repo compartido). Este repo solo tiene el outbox en el Supabase de este producto (`https://nheyqairforzviwheyrq.supabase.co`) y el compose de `infra/docker-compose.yml`.

La serie de este producto es `MK`. El cobro de prueba es el price `menoska-fakturabai-test-050` (`price_1UWIJHF3yyKUpy6tMLQyWgMw`, 0,50 €, sin publicar en la web).

No pasar el worker a producción (`FAKTURABAI_ENV`, `FAKTURABAI_DRY_RUN`, `FAKTURABAI_STANDBY`) sin confirmación explícita. El worker de Proposalyze no debe apuntar a este proyecto. La serie `MK` la asigna el trigger `mc_legal_invoice_menoska_serie` al insertar la factura.
