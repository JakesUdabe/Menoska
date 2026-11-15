"use client";

import { useSearchParams } from "next/navigation";
import { LoginForm } from "@/components/access-form";

export function LoginScreen() {
  const error = useSearchParams().get("error") ?? undefined;
  return <LoginForm error={error} />;
}
