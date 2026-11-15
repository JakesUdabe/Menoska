"use client";

import type { ServiceId } from "@/data/services";
import { browserClient } from "@/lib/supabase/browser";
import type { ModuleEntry, Profile } from "@/lib/workspace";

const MODE = "menoska-mode";
const CLIENT = "menoska-client";

export function readCookie(name: string) {
  if (typeof document === "undefined") return "";
  const match = document.cookie.split("; ").find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

export function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax; Max-Age=31536000`;
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = browserClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, first_name, last_name, nif, email")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!profile || (profile.role !== "admin" && profile.role !== "client" && profile.role !== "empleado")) return null;
  return profile as Profile;
}

export async function listClients() {
  const supabase = browserClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("profiles")
    .select("id, role, first_name, last_name, nif, email")
    .eq("role", "client")
    .order("last_name");
  return (data ?? []) as Profile[];
}

export async function workspaceContext() {
  const profile = await getProfile();
  if (!profile) return null;
  const mode = profile.role === "admin" && readCookie(MODE) === "client" ? "client" : profile.role === "admin" ? "admin" : "client";
  const clientId = profile.role === "client" ? profile.id : readCookie(CLIENT);
  return {
    profile,
    mode: mode as "admin" | "client",
    clientId,
    canEdit: profile.role === "admin" && mode === "admin",
  };
}

export async function listEntries(clientId: string, module: ServiceId, kind: "kpi" | "report") {
  const supabase = browserClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("module_entries")
    .select("id, client_id, module, kind, title, body, value, unit, sort_order")
    .eq("client_id", clientId)
    .eq("module", module)
    .eq("kind", kind)
    .order("sort_order");
  return (data ?? []) as ModuleEntry[];
}

export { CLIENT, MODE };
