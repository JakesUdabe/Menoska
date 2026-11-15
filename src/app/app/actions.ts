"use client";

import type { ServiceId } from "@/data/services";
import type { CvCredential, CvEducation, CvExperience } from "@/lib/content";
import { browserClient } from "@/lib/supabase/browser";
import { getProfile, readCookie, writeCookie, CLIENT, MODE } from "@/lib/session";
import { modules } from "@/lib/workspace";

function go(path: string) {
  window.location.assign(path);
}

function safeNext(formData: FormData, fallback: string) {
  const next = String(formData.get("next") ?? "").trim();
  if (!next.startsWith("/admin/contenido") && !next.startsWith("/app/admin")) return fallback;
  if (next.includes("://") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}

function withNotice(path: string, key: "ok" | "error", value: string) {
  const url = new URL(path, "http://local");
  if (key === "ok") {
    url.searchParams.set("ok", value);
    url.searchParams.delete("error");
  } else {
    url.searchParams.set("error", value);
    url.searchParams.delete("ok");
  }
  return `${url.pathname}${url.search}`;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

async function requireAdmin() {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") {
    go("/app");
    return null;
  }
  return profile;
}

async function selectedClientId() {
  const profile = await getProfile();
  if (!profile) {
    go("/acceso");
    return "";
  }
  if (profile.role === "client") return profile.id;
  return readCookie(CLIENT);
}

export async function setWorkspace(formData: FormData) {
  if (!(await requireAdmin())) return;
  const mode = formData.get("mode") === "client" ? "client" : "admin";
  const clientId = String(formData.get("clientId") ?? "");
  const supabase = browserClient();
  if (!supabase) return;
  if (clientId) {
    const { data } = await supabase.from("profiles").select("id").eq("id", clientId).eq("role", "client").maybeSingle();
    if (!data) {
      go("/app");
      return;
    }
  }
  writeCookie(MODE, mode);
  if (clientId) writeCookie(CLIENT, clientId);
  go(mode === "admin" ? "/app/admin" : `/app/${modules[0].slug}`);
}

export async function logout() {
  const supabase = browserClient();
  if (supabase) await supabase.auth.signOut();
  go("/");
}

export async function addEntry(formData: FormData) {
  if (!(await requireAdmin())) return;
  const clientId = await selectedClientId();
  const moduleId = String(formData.get("module") ?? "") as ServiceId;
  const kind = formData.get("kind") === "report" ? "report" : "kpi";
  const title = String(formData.get("title") ?? "").trim();
  if (!clientId || !modules.some((item) => item.id === moduleId) || !title) {
    go("/app");
    return;
  }
  const supabase = browserClient();
  if (!supabase) return;
  const { count } = await supabase
    .from("module_entries")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("module", moduleId)
    .eq("kind", kind);
  await supabase.from("module_entries").insert({
    client_id: clientId,
    module: moduleId,
    kind,
    title,
    body: String(formData.get("body") ?? "").trim(),
    value: String(formData.get("value") ?? "").trim(),
    unit: String(formData.get("unit") ?? "").trim(),
    sort_order: count ?? 0,
  });
  window.location.reload();
}

export async function deleteEntry(formData: FormData) {
  if (!(await requireAdmin())) return;
  const id = String(formData.get("id") ?? "");
  const supabase = browserClient();
  if (!supabase) return;
  await supabase.from("module_entries").delete().eq("id", id);
  window.location.reload();
}

async function storeImage(file: File, folder: string) {
  if (!file.size || file.size > 5_000_000) return null;
  if (!["image/jpeg", "image/png", "image/webp", "image/svg+xml", "image/gif"].includes(file.type)) return null;
  const ext = file.type === "image/svg+xml" ? "svg" : file.type.split("/")[1] || "bin";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const supabase = browserClient();
  if (!supabase) return null;
  const { error } = await supabase.storage.from("site").upload(path, file, { contentType: file.type });
  if (error) return null;
  return supabase.storage.from("site").getPublicUrl(path).data.publicUrl;
}

export async function saveCover(formData: FormData) {
  if (!(await requireAdmin())) return;
  const supabase = browserClient();
  if (!supabase) return;
  const patch: { hero_image_url?: string; about_image_url?: string } = {};
  const hero = formData.get("hero");
  const about = formData.get("about");
  if (hero instanceof File && hero.size) {
    const url = await storeImage(hero, "hero");
    if (url) patch.hero_image_url = url;
  }
  if (about instanceof File && about.size) {
    const url = await storeImage(about, "about");
    if (url) patch.about_image_url = url;
  }
  if (Object.keys(patch).length) await supabase.from("site_settings").update(patch).eq("id", 1);
  go(withNotice(safeNext(formData, "/app/admin?seccion=portada"), "ok", "1"));
}

export async function saveStats(formData: FormData) {
  if (!(await requireAdmin())) return;
  const patch: Record<string, string | number> = {};
  for (const index of [1, 2, 3, 4]) {
    const value = Number(formData.get(`value_${index}`));
    patch[`stat_${index}_value`] = Number.isFinite(value) ? Math.round(value) : 0;
    patch[`stat_${index}_prefix`] = String(formData.get(`prefix_${index}`) ?? "").slice(0, 8);
    patch[`stat_${index}_suffix`] = String(formData.get(`suffix_${index}`) ?? "").slice(0, 12);
  }
  const supabase = browserClient();
  if (!supabase) return;
  await supabase.from("site_settings").update(patch).eq("id", 1);
  go(withNotice(safeNext(formData, "/app/admin?seccion=numeros"), "ok", "1"));
}

export async function addTrajectory(formData: FormData) {
  if (!(await requireAdmin())) return;
  const name = String(formData.get("name") ?? "").trim();
  const href = String(formData.get("href") ?? "").trim();
  const next = safeNext(formData, "/app/admin?seccion=trayectoria");
  if (!name || !href.startsWith("http")) {
    go(withNotice(next, "error", "datos"));
    return;
  }
  const file = formData.get("logo");
  const logo = file instanceof File && file.size ? await storeImage(file, "logos") : null;
  const supabase = browserClient();
  if (!supabase) return;
  const { count } = await supabase.from("trajectory_items").select("id", { count: "exact", head: true });
  await supabase.from("trajectory_items").insert({ name, href, logo_url: logo, sort_order: count ?? 0 });
  go(withNotice(next, "ok", "1"));
}

export async function updateTrajectory(formData: FormData) {
  if (!(await requireAdmin())) return;
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const href = String(formData.get("href") ?? "").trim();
  const sort = Number(formData.get("sort") ?? 0);
  const next = safeNext(formData, "/app/admin?seccion=trayectoria");
  if (!id || !name || !href.startsWith("http")) {
    go(withNotice(next, "error", "datos"));
    return;
  }
  const file = formData.get("logo");
  const patch: { name: string; href: string; sort_order: number; logo_url?: string } = {
    name,
    href,
    sort_order: Number.isFinite(sort) ? sort : 0,
  };
  if (file instanceof File && file.size) {
    const logo = await storeImage(file, "logos");
    if (logo) patch.logo_url = logo;
  }
  const supabase = browserClient();
  if (!supabase) return;
  await supabase.from("trajectory_items").update(patch).eq("id", id);
  go(withNotice(next, "ok", "1"));
}

export async function deleteTrajectory(formData: FormData) {
  if (!(await requireAdmin())) return;
  const id = String(formData.get("id") ?? "");
  const supabase = browserClient();
  if (!supabase) return;
  await supabase.from("trajectory_items").delete().eq("id", id);
  go(safeNext(formData, "/app/admin?seccion=trayectoria"));
}

export async function createEmployee(formData: FormData) {
  if (!(await requireAdmin())) return;
  const name = String(formData.get("name") ?? "").trim();
  const next = safeNext(formData, "/app/admin?seccion=equipo");
  if (!name) {
    go(withNotice(next, "error", "datos"));
    return;
  }
  const supabase = browserClient();
  if (!supabase) return;
  let slug = slugify(name) || "persona";
  const { data: taken } = await supabase.from("employees").select("slug").like("slug", `${slug}%`);
  if (taken?.some((row: { slug: string }) => row.slug === slug)) slug = `${slug}-${(taken?.length ?? 0) + 1}`;
  const { data } = await supabase
    .from("employees")
    .insert({ slug, name, role: "Equipo", sort_order: taken?.length ?? 0 })
    .select("id")
    .single();
  if (!data?.id) {
    go(next);
    return;
  }
  if (next.startsWith("/admin/contenido")) {
    const url = new URL(next, "http://local");
    url.searchParams.set("id", data.id);
    go(`${url.pathname}${url.search}`);
    return;
  }
  go(`/app/admin/equipo?id=${data.id}`);
}

export async function saveEmployee(input: {
  id: string;
  name: string;
  role: string;
  bio: string;
  summary: string;
  linkedin: string;
  visible: boolean;
  experience: CvExperience[];
  education: CvEducation[];
  credentials: CvCredential[];
  returnTo?: string;
}) {
  if (!(await requireAdmin())) return;
  const supabase = browserClient();
  if (!supabase) return;
  await supabase
    .from("employees")
    .update({
      name: input.name.trim(),
      role: input.role.trim(),
      bio: input.bio.trim(),
      summary: input.summary.trim(),
      linkedin: input.linkedin.trim() || null,
      visible: input.visible,
      experience: input.experience,
      education: input.education,
      credentials: input.credentials,
    })
    .eq("id", input.id);
  const requested = input.returnTo?.trim() ?? "";
  const next =
    requested.startsWith("/admin/contenido") || requested.startsWith("/app/admin")
      ? requested
      : `/app/admin/equipo?id=${input.id}`;
  go(withNotice(next, "ok", "1"));
}

export async function saveEmployeePhoto(formData: FormData) {
  if (!(await requireAdmin())) return;
  const id = String(formData.get("id") ?? "");
  const next = safeNext(formData, `/app/admin/equipo?id=${id}`);
  const file = formData.get("photo");
  if (!(file instanceof File) || !file.size) {
    go(next);
    return;
  }
  const url = await storeImage(file, "people");
  if (!url) {
    go(withNotice(next, "error", "imagen"));
    return;
  }
  const supabase = browserClient();
  if (!supabase) return;
  await supabase.from("employees").update({ image_url: url }).eq("id", id);
  go(withNotice(next, "ok", "1"));
}

export async function deleteEmployee(formData: FormData) {
  if (!(await requireAdmin())) return;
  const id = String(formData.get("id") ?? "");
  const supabase = browserClient();
  if (!supabase) return;
  await supabase.from("employees").delete().eq("id", id);
  go(safeNext(formData, "/app/admin?seccion=equipo"));
}

export async function inviteUser(formData: FormData) {
  if (!(await requireAdmin())) return;
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const nif = String(formData.get("nif") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const next = safeNext(formData, "/app/admin?seccion=usuarios");
  const role = formData.get("role") === "admin" ? "admin" : "client";
  if (!firstName || !lastName || !nif || !email.includes("@")) {
    go(withNotice(next, "error", "datos"));
    return;
  }
  const supabase = browserClient();
  if (!supabase) {
    go(withNotice(next, "error", "correo"));
    return;
  }
  const { data, error } = await supabase.functions.invoke("invite-user", {
    body: { firstName, lastName, nif, email, role, origin: window.location.origin },
  });
  const code = typeof data?.code === "string" ? data.code : "correo";
  if (error || !data?.ok) {
    go(withNotice(next, "error", code === "datos" || code === "existe" || code === "nif" ? code : "correo"));
    return;
  }
  go(withNotice(next, "ok", "1"));
}
