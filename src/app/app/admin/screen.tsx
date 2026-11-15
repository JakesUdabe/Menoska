"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminPanel } from "@/components/admin-panel";
import type { CvCredential, CvEducation, CvExperience, PublicEmployee } from "@/lib/content";
import { browserClient } from "@/lib/supabase/browser";
import { getProfile } from "@/lib/session";
import type { Profile } from "@/lib/workspace";

const sections = ["portada", "trayectoria", "numeros", "equipo", "usuarios"] as const;

export function AdminScreen() {
  const router = useRouter();
  const query = useSearchParams();
  const section = sections.find((item) => item === query.get("seccion")) ?? "portada";
  const notice = query.get("ok") ? "ok" : query.get("error") ?? undefined;
  const [data, setData] = useState<{
    settings: Parameters<typeof AdminPanel>[0]["settings"];
    trajectory: Parameters<typeof AdminPanel>[0]["trajectory"];
    employees: PublicEmployee[];
    users: Profile[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const profile = await getProfile();
      if (!profile || profile.role !== "admin") {
        router.replace("/app");
        return;
      }
      const supabase = browserClient();
      if (!supabase) return;
      const [settings, trajectory, employees, users] = await Promise.all([
        supabase.from("site_settings").select("*").eq("id", 1).single(),
        supabase.from("trajectory_items").select("id, name, href, logo_url, sort_order").order("sort_order"),
        supabase.from("employees").select("*").order("sort_order"),
        supabase.from("profiles").select("id, role, first_name, last_name, nif, email").order("last_name"),
      ]);
      if (cancelled || !settings.data) return;
      const people: PublicEmployee[] = (employees.data ?? []).map((item: {
        id: string;
        slug: string;
        name: string;
        role: string;
        bio: string;
        image_url: string;
        linkedin: string | null;
        summary: string;
        experience: CvExperience[] | null;
        education: CvEducation[] | null;
        credentials: CvCredential[] | null;
        visible: boolean;
      }) => ({
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
      setData({
        settings: settings.data,
        trajectory: trajectory.data ?? [],
        employees: people,
        users: (users.data ?? []) as Profile[],
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!data) return <p className="wrap">Cargando…</p>;
  return (
    <AdminPanel
      section={section}
      notice={notice}
      settings={data.settings}
      trajectory={data.trajectory}
      employees={data.employees}
      users={data.users}
    />
  );
}
