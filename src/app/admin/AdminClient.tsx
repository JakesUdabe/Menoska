"use client";

import dynamic from "next/dynamic";

const AdminApp = dynamic(() => import("./AdminApp").then((mod) => mod.AdminApp), {
  ssr: false,
  loading: () => <p className="admin-root">Cargando módulo…</p>,
});

export function AdminClient() {
  return <AdminApp />;
}
