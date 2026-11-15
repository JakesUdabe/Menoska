import { Suspense } from "react";
import { AdminScreen } from "./screen";

export default function AdminPage() {
  return (
    <Suspense fallback={<p className="wrap">Cargando…</p>}>
      <AdminScreen />
    </Suspense>
  );
}
