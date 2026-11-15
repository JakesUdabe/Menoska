"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AdminPanel } from "@/components/admin-panel";
import { EmployeeEditor } from "@/components/employee-editor";
import type { CvCredential, CvEducation, CvExperience, PublicEmployee } from "@/lib/content";
import { supabase } from "@/dashboard/integrations/supabase/client";
import type { Profile } from "@/lib/workspace";

const sections = ["portada", "trayectoria", "numeros", "equipo", "usuarios"] as const;

type Section = (typeof sections)[number];

type PanelData = {
  settings: Parameters<typeof AdminPanel>[0]["settings"];
  trajectory: Parameters<typeof AdminPanel>[0]["trajectory"];
  employees: PublicEmployee[];
  users: Profile[];
};

export default function AdminContenidoPage() {
  const [params] = useSearchParams();
  const requested = params.get("seccion");
  const section: Section = sections.find((item) => item === requested) ?? "portada";
  const personId = params.get("id") ?? "";
  const notice = params.get("ok") ? "ok" : params.get("error") ?? undefined;
  const [data, setData] = useState<PanelData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    (async () => {
      const [settings, trajectory, employees, users] = await Promise.all([
        supabase.from("site_settings").select("*").eq("id", 1).single(),
        supabase.from("trajectory_items").select("id, name, href, logo_url, sort_order").order("sort_order"),
        supabase.from("employees").select("*").order("sort_order"),
        supabase.from("profiles").select("id, role, first_name, last_name, nif, email").order("last_name"),
      ]);
      if (cancelled) return;
      if (settings.error || !settings.data) {
        setFailed(true);
        return;
      }
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
  }, [params]);

  if (failed) return <p className="wrap">No se ha podido cargar el contenido.</p>;
  if (!data) return <p className="wrap">Cargando…</p>;

  const person = personId ? data.employees.find((item) => item.id === personId) : undefined;
  if (section === "equipo" && person) {
    const returnTo = `/admin/contenido?seccion=equipo&id=${person.id}`;
    return (
      <div>
        <p className="wrap">
          <a href="/admin/contenido?seccion=equipo">Volver al equipo</a>
        </p>
        <EmployeeEditor person={person} notice={notice} returnTo={returnTo} />
      </div>
    );
  }

  return (
    <AdminPanel
      base="/admin/contenido"
      section={section}
      notice={notice}
      settings={data.settings}
      trajectory={data.trajectory}
      employees={data.employees}
      users={data.users}
    />
  );
}
