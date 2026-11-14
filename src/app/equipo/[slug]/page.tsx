import { redirect } from "next/navigation";

export default async function CvRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/sobre-nosotros/${slug}`);
}
