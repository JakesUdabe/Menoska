import { supabase } from "@dashboard/integrations/supabase/client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Builder sin tipar: estas tablas aún no están en el Database generado. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function salesFrom(table: string): any {
  return (supabase as unknown as { from: (name: string) => unknown }).from(table);
}

export async function resolveStartupId(idOrSlug: string): Promise<string> {
  const value = idOrSlug.trim();
  if (UUID_RE.test(value)) return value;
  const { data, error } = await salesFrom("sales_startups")
    .select("id")
    .eq("slug", value)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const id = data?.id;
  if (typeof id !== "string") throw new Error(`Startup no encontrada: ${value}`);
  return id;
}
