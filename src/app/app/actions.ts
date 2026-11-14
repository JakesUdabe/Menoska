"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ServiceId } from "@/data/services";
import type { CvCredential, CvEducation, CvExperience } from "@/lib/content";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getProfile, modules } from "@/lib/workspace";

const MODE = "menoska-mode";
const CLIENT = "menoska-client";

function inviteLink(
  site: string,
  properties?: { hashed_token?: string; verification_type?: string; action_link?: string } | null,
) {
  if (!properties) return undefined;
  if (properties.hashed_token) {
    const type = properties.verification_type || "invite";
    return `${site}/auth/confirm?token_hash=${encodeURIComponent(properties.hashed_token)}&type=${encodeURIComponent(type)}`;
  }
  return properties.action_link;
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
  if (!profile || profile.role !== "admin") redirect("/app");
  return profile;
}

async function selectedClientId() {
  const profile = await getProfile();
  if (!profile) redirect("/acceso");
  if (profile.role === "client") return profile.id;
  const jar = await cookies();
  return jar.get(CLIENT)?.value ?? "";
}

export async function setWorkspace(formData: FormData) {
  await requireAdmin();
  const mode = formData.get("mode") === "client" ? "client" : "admin";
  const clientId = String(formData.get("clientId") ?? "");
  const supabase = await createClient();
  if (clientId) {
    const { data } = await supabase.from("profiles").select("id").eq("id", clientId).eq("role", "client").maybeSingle();
    if (!data) redirect("/app");
  }
  const jar = await cookies();
  jar.set(MODE, mode, { httpOnly: true, sameSite: "lax", path: "/" });
  if (clientId) jar.set(CLIENT, clientId, { httpOnly: true, sameSite: "lax", path: "/" });
  revalidatePath("/app");
  redirect(mode === "admin" ? "/app/admin" : `/app/${modules[0].slug}`);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function addEntry(formData: FormData) {
  await requireAdmin();
  const clientId = await selectedClientId();
  const moduleId = String(formData.get("module") ?? "") as ServiceId;
  const kind = formData.get("kind") === "report" ? "report" : "kpi";
  const title = String(formData.get("title") ?? "").trim();
  if (!clientId || !modules.some((item) => item.id === moduleId) || !title) redirect("/app");
  const supabase = await createClient();
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
  const slug = modules.find((item) => item.id === moduleId)?.slug ?? "";
  revalidatePath(`/app/${slug}`);
  revalidatePath(`/app/${slug}/informe`);
}

export async function deleteEntry(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const supabase = await createClient();
  await supabase.from("module_entries").delete().eq("id", id);
  revalidatePath(`/app/${slug}`);
  revalidatePath(`/app/${slug}/informe`);
}

async function storeImage(file: File, folder: string) {
  if (!file.size || file.size > 5_000_000) return null;
  if (!["image/jpeg", "image/png", "image/webp", "image/svg+xml", "image/gif"].includes(file.type)) return null;
  const ext = file.type === "image/svg+xml" ? "svg" : file.type.split("/")[1] || "bin";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const supabase = await createClient();
  const { error } = await supabase.storage.from("site").upload(path, file, { contentType: file.type });
  if (error) return null;
  return supabase.storage.from("site").getPublicUrl(path).data.publicUrl;
}

export async function saveCover(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
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
  revalidatePath("/");
  redirect("/app/admin?seccion=portada&ok=1");
}

export async function saveStats(formData: FormData) {
  await requireAdmin();
  const patch: Record<string, string | number> = {};
  for (const index of [1, 2, 3, 4]) {
    const value = Number(formData.get(`value_${index}`));
    patch[`stat_${index}_value`] = Number.isFinite(value) ? Math.round(value) : 0;
    patch[`stat_${index}_prefix`] = String(formData.get(`prefix_${index}`) ?? "").slice(0, 8);
    patch[`stat_${index}_suffix`] = String(formData.get(`suffix_${index}`) ?? "").slice(0, 12);
  }
  const supabase = await createClient();
  await supabase.from("site_settings").update(patch).eq("id", 1);
  revalidatePath("/");
  redirect("/app/admin?seccion=numeros&ok=1");
}

export async function addTrajectory(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const href = String(formData.get("href") ?? "").trim();
  if (!name || !href.startsWith("http")) redirect("/app/admin?seccion=trayectoria&error=datos");
  const file = formData.get("logo");
  const logo = file instanceof File && file.size ? await storeImage(file, "logos") : null;
  const supabase = await createClient();
  const { count } = await supabase.from("trajectory_items").select("id", { count: "exact", head: true });
  await supabase.from("trajectory_items").insert({ name, href, logo_url: logo, sort_order: count ?? 0 });
  revalidatePath("/");
  redirect("/app/admin?seccion=trayectoria&ok=1");
}

export async function updateTrajectory(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const href = String(formData.get("href") ?? "").trim();
  const sort = Number(formData.get("sort") ?? 0);
  if (!id || !name || !href.startsWith("http")) redirect("/app/admin?seccion=trayectoria&error=datos");
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
  const supabase = await createClient();
  await supabase.from("trajectory_items").update(patch).eq("id", id);
  revalidatePath("/");
  redirect("/app/admin?seccion=trayectoria&ok=1");
}

export async function deleteTrajectory(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  await supabase.from("trajectory_items").delete().eq("id", id);
  revalidatePath("/");
  redirect("/app/admin?seccion=trayectoria");
}

export async function createEmployee(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/app/admin?seccion=equipo&error=datos");
  const supabase = await createClient();
  let slug = slugify(name) || "persona";
  const { data: taken } = await supabase.from("employees").select("slug").like("slug", `${slug}%`);
  if (taken?.some((row) => row.slug === slug)) slug = `${slug}-${(taken?.length ?? 0) + 1}`;
  const { data } = await supabase
    .from("employees")
    .insert({ slug, name, role: "Equipo", sort_order: taken?.length ?? 0 })
    .select("id")
    .single();
  revalidatePath("/sobre-nosotros");
  redirect(data ? `/app/admin/equipo/${data.id}` : "/app/admin?seccion=equipo");
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
}) {
  await requireAdmin();
  const supabase = await createClient();
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
  revalidatePath("/sobre-nosotros");
  revalidatePath("/");
  redirect(`/app/admin/equipo/${input.id}?ok=1`);
}

export async function saveEmployeePhoto(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const file = formData.get("photo");
  if (!(file instanceof File) || !file.size) redirect(`/app/admin/equipo/${id}`);
  const url = await storeImage(file, "people");
  if (!url) redirect(`/app/admin/equipo/${id}?error=imagen`);
  const supabase = await createClient();
  await supabase.from("employees").update({ image_url: url }).eq("id", id);
  revalidatePath("/sobre-nosotros");
  revalidatePath("/");
  redirect(`/app/admin/equipo/${id}?ok=1`);
}

export async function deleteEmployee(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  await supabase.from("employees").delete().eq("id", id);
  revalidatePath("/sobre-nosotros");
  revalidatePath("/");
  redirect("/app/admin?seccion=equipo");
}

export async function inviteUser(formData: FormData) {
  await requireAdmin();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const nif = String(formData.get("nif") ?? "").trim().toUpperCase();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = formData.get("role") === "admin" ? "admin" : "client";
  if (!firstName || !lastName || !nif || !email.includes("@")) {
    redirect("/app/admin?seccion=usuarios&error=datos");
  }

  const admin = createAdminClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const generated = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      data: { first_name: firstName, last_name: lastName, nif },
      redirectTo: `${site}/auth/confirm`,
    },
  });

  let link = inviteLink(site, generated.data.properties);
  let userId = generated.data.user?.id;

  if (generated.error || !link || !userId) {
    const recovery = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${site}/auth/confirm` },
    });
    link = inviteLink(site, recovery.data.properties);
    userId = recovery.data.user?.id;
    if (recovery.error || !link || !userId) redirect("/app/admin?seccion=usuarios&error=correo");
  }

  await admin.auth.admin.updateUserById(userId, {
    app_metadata: { role },
    user_metadata: { first_name: firstName, last_name: lastName, nif },
  });
  await admin.from("profiles").upsert({
    id: userId,
    role,
    first_name: firstName,
    last_name: lastName,
    nif,
    email,
  });

  const sent = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: [email],
      subject: "Crea tu acceso a Menoska Consulting",
      html: `<p>Hola ${firstName},</p><p>Tienes un acceso a Menoska Consulting. Abre este enlace para crear tu contraseña:</p><p><a href="${link}">Crear cuenta</a></p><p>Después podrás entrar en ${site}/acceso.</p><p>Si no esperabas este correo, puedes ignorarlo.</p>`,
    }),
  });
  revalidatePath("/app/admin");
  redirect(sent.ok ? "/app/admin?seccion=usuarios&ok=1" : "/app/admin?seccion=usuarios&error=correo");
}
