"use client";

import AdminDocumentosPage from "@/components/admin/core/AdminDocumentosPage";
import { RoleRoute } from "@/components/admin/core/RoleRoute";

export default function Page() {
  return (
    <RoleRoute module="documentos">
      <AdminDocumentosPage />
    </RoleRoute>
  );
}
