"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EmployeeEditor } from "@/components/employee-editor";
import type { CvCredential, CvEducation, CvExperience, PublicEmployee } from "@/lib/content";
import { browserClient } from "@/lib/supabase/browser";
import { getProfile } from "@/lib/session";

export function EmployeeScreen() {
  const router = useRouter();
  const query = useSearchParams();
  const id = query.get("id") ?? "";
  const notice = query.get("ok") ? "ok" : query.get("error") ?? undefined;
  const [person, setPerson] = useState<PublicEmployee | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const profile = await getProfile();
      if (!profile || profile.role !== "admin") {
        router.replace("/app");
        return;
      }
      if (!id) {
        router.replace("/app/admin?seccion=equipo");
        return;
      }
      const supabase = browserClient();
      if (!supabase) return;
      const { data } = await supabase.from("employees").select("*").eq("id", id).maybeSingle();
      if (!data) {
        router.replace("/app/admin?seccion=equipo");
        return;
      }
      if (cancelled) return;
      setPerson({
        id: data.id,
        slug: data.slug,
        name: data.name,
        role: data.role,
        bio: data.bio,
        image: data.image_url,
        linkedin: data.linkedin ?? "",
        summary: data.summary,
        experience: (data.experience ?? []) as CvExperience[],
        education: (data.education ?? []) as CvEducation[],
        credentials: (data.credentials ?? []) as CvCredential[],
        visible: data.visible,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  if (!person) return <p className="wrap">Cargando…</p>;
  return <EmployeeEditor person={person} notice={notice} />;
}
