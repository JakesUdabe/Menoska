-- Adds the internal staff role used by the portable admin.
-- Must commit before any statement reads the new enum label.
alter type public.mc_app_role add value if not exists 'empleado';
