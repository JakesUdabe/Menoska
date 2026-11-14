import { notFound, redirect } from "next/navigation";
import { EmployeeEditor } from "@/components/employee-editor";
import type { CvCredential, CvEducation, CvExperience, PublicEmployee } from "@/lib/content";
import { createClient } from "@/lib/supabase/server";
import { workspaceContext } from "@/lib/workspace";

export default async function EmployeePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { profile } = await workspaceContext();
  if (profile.role !== "admin") redirect("/app");
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("employees").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const person: PublicEmployee = {
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
  };
  return <EmployeeEditor person={person} notice={query.ok ? "ok" : query.error} />;
}
