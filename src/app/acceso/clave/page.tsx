import { Suspense } from "react";
import { PasswordScreen } from "./password-screen";

export default function PasswordPage() {
  return (
    <section className="access-page">
      <Suspense fallback={null}>
        <PasswordScreen />
      </Suspense>
    </section>
  );
}
