import { Suspense } from "react";
import { LoginScreen } from "./login-screen";

export default function AccessPage() {
  return (
    <section className="access-page">
      <Suspense fallback={null}>
        <LoginScreen />
      </Suspense>
    </section>
  );
}
