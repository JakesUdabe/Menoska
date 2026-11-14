import { PasswordForm } from "@/components/access-form";

export default async function PasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <section className="access-page">
      <PasswordForm error={error} />
    </section>
  );
}
