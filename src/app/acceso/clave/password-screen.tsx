"use client";

import { useSearchParams } from "next/navigation";
import { PasswordForm } from "@/components/access-form";

export function PasswordScreen() {
  const error = useSearchParams().get("error") ?? undefined;
  return <PasswordForm error={error} />;
}
