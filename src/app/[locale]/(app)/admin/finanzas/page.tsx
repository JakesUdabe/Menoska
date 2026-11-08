"use client";

import AdminFinanzasPage from "@/components/admin/core/AdminFinanzasPage";
import { RoleRoute } from "@/components/admin/core/RoleRoute";

export default function Page() {
  return (
    <RoleRoute module="finanzas">
      <AdminFinanzasPage />
    </RoleRoute>
  );
}
