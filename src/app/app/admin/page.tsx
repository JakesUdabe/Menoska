import { redirect } from "next/navigation";
import { AdminPanel } from "@/components/admin-panel";
import type { CvCredential, CvEducation, CvExperience, PublicEmployee } from "@/lib/content";
import { createClient } from "@/lib/supabase/server";
import { workspaceContext, type Profile } from "@/lib/workspace";

const sections = ["portada", "trayectoria", "numeros", "equipo", "usuarios"] as const;

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ seccion?: string; ok?: string; error?: string }> }) {
  const { profile } = await workspaceContext();
  if (profile.role !== "admin") redirect("/app");
  const query = await searchParams;
  const section = sections.find((item) => item === query.seccion) ?? "portada";
  const supabase = await createClient();
  const [settings, trajectory, employees, users] = await Promise.all([
    supabase.from("site_settings").select("*").eq("id", 1).single(),
    supabase.from("trajectory_items").select("id, name, href, logo_url, sort_order").order("sort_order"),
    supabase.from("employees").select("*").order("sort_order"),
    supabase.from("profiles").select("id, role, first_name, last_name, nif, email").order("last_name"),
  ]);

  const people: PublicEmployee[] = (employees.data ?? []).map((item) => ({
    id: item.id,
    slug: item.slug,
    name: item.name,
    role: item.role,
    bio: item.bio,
    image: item.image_url,
    linkedin: item.linkedin ?? "",
    summary: item.summary,
    experience: (item.experience ?? []) as CvExperience[],
    education: (item.education ?? []) as CvEducation[],
    credentials: (item.credentials ?? []) as CvCredential[],
    visible: item.visible,
  }));

  return (
    <AdminPanel
      section={section}
      notice={query.ok ? "ok" : query.error}
      settings={settings.data}
      trajectory={trajectory.data ?? []}
      employees={people}
      users={(users.data ?? []) as Profile[]}
    />
  );
}
