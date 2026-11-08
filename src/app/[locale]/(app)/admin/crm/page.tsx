"use client";

import AdminCrmPage from "@/components/admin/core/AdminCrmPage";
import { RoleRoute } from "@/components/admin/core/RoleRoute";

export default function Page() {
  return (
    <RoleRoute module="crm">
      <AdminCrmPage />
    </RoleRoute>
  );
}
