import { LoginForm } from "@/components/access-form";

export default async function AccessPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <section className="access-page">
      <LoginForm error={error} />
    </section>
  );
}
