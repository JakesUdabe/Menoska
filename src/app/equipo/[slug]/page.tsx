import { redirect } from "next/navigation";
import { employeeParams } from "@/lib/content";

export async function generateStaticParams() {
  return employeeParams();
}

export default async function CvRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/sobre-nosotros/${slug}`);
}
