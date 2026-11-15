"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppFrame } from "@/components/app-frame";
import { listClients, workspaceContext } from "@/lib/session";
import type { Profile } from "@/lib/workspace";

type WorkspaceState = {
  profile: Profile;
  clients: Profile[];
  mode: "admin" | "client";
  clientId: string;
};

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<WorkspaceState | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const context = await workspaceContext();
      if (!context) {
        router.replace("/acceso");
        return;
      }
      if (context.profile.role === "empleado") {
        window.location.replace("/admin/");
        return;
      }
      const clients = context.profile.role === "admin" ? await listClients() : [];
      if (!cancelled) setState({ ...context, clients });
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!state) return <p className="wrap">Cargando…</p>;
  return (
    <AppFrame profile={state.profile} clients={state.clients} mode={state.mode} clientId={state.clientId}>
      {children}
    </AppFrame>
  );
}
