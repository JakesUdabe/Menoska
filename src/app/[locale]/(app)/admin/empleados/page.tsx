"use client";

import AdminEmpleadosPage from "@/components/admin/core/AdminEmpleadosPage";
import { RoleRoute } from "@/components/admin/core/RoleRoute";

export default function Page() {
  return (
    <RoleRoute module="empleados">
      <AdminEmpleadosPage />
    </RoleRoute>
  );
}
