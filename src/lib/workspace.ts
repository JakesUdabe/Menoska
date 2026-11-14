import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { serviceCatalog, type ServiceId } from "@/data/services";
import { es } from "@/i18n/es";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  role: "admin" | "client";
  first_name: string;
  last_name: string;
  nif: string | null;
  email: string;
};

export type ModuleEntry = {
  id: string;
  client_id: string;
  module: ServiceId;
  kind: "kpi" | "report";
  title: string;
  body: string;
  value: string;
  unit: string;
  sort_order: number;
};

export const modules = serviceCatalog.map((service) => ({
  id: service.id,
  slug: service.slug,
  name: es.services[service.id].menu,
}));

export function moduleBySlug(slug: string) {
  return modules.find((item) => item.slug === slug);
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await supabase.from("profiles").select("id, role, first_name, last_name, nif, email").eq("id", data.user.id).maybeSingle();
  if (!profile || (profile.role !== "admin" && profile.role !== "client")) return null;
  return profile as Profile;
}

export async function listClients() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, role, first_name, last_name, nif, email")
    .eq("role", "client")
    .order("last_name");
  return (data ?? []) as Profile[];
}

export async function workspaceContext() {
  const profile = await getProfile();
  if (!profile) redirect("/acceso");
  const jar = await cookies();
  const mode = profile.role === "admin" && jar.get("menoska-mode")?.value === "client" ? "client" : profile.role === "admin" ? "admin" : "client";
  const clientId = profile.role === "client" ? profile.id : jar.get("menoska-client")?.value ?? "";
  return {
    profile,
    mode: mode as "admin" | "client",
    clientId,
    canEdit: profile.role === "admin" && mode === "admin",
  };
}

export async function listEntries(clientId: string, module: ServiceId, kind: "kpi" | "report") {
  const supabase = await createClient();
  const { data } = await supabase
    .from("module_entries")
    .select("id, client_id, module, kind, title, body, value, unit, sort_order")
    .eq("client_id", clientId)
    .eq("module", module)
    .eq("kind", kind)
    .order("sort_order");
  return (data ?? []) as ModuleEntry[];
}
