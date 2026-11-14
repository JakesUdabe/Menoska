import { notFound } from "next/navigation";
import { CvView } from "@/components/cv-view";
import { loadEmployee } from "@/lib/content";

export default async function AboutCvPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const person = await loadEmployee(slug);
  if (!person) notFound();
  return <CvView person={person} />;
}
