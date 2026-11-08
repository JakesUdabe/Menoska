/**
 * Documented RLS helper function names used in mc_* policies.
 * Unit tests assert these identifiers stay stable for multi-tenant isolation.
 */
export const MC_RLS_HELPERS = [
  "private.mc_current_org_id",
  "private.mc_current_role",
  "private.mc_is_superadmin",
] as const;

export type McRlsHelper = (typeof MC_RLS_HELPERS)[number];

export function isMcRlsHelper(name: string): name is McRlsHelper {
  return (MC_RLS_HELPERS as readonly string[]).includes(name);
}
