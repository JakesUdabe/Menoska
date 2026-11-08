"use client";

import AdminCalendarioPage from "@/components/admin/core/AdminCalendarioPage";
import { RoleRoute } from "@/components/admin/core/RoleRoute";

export default function Page() {
  return (
    <RoleRoute module="calendario">
      <AdminCalendarioPage />
    </RoleRoute>
  );
}
