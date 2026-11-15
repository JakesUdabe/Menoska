import { Suspense } from "react";
import { EmployeeScreen } from "./screen";

export default function EmployeePage() {
  return (
    <Suspense fallback={<p className="wrap">Cargando…</p>}>
      <EmployeeScreen />
    </Suspense>
  );
}
