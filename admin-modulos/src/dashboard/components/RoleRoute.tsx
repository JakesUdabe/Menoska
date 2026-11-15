import { Navigate } from "react-router-dom";
import { useAuth } from "@dashboard/contexts/AuthContext";
import {
  type AdminModule,
  getDefaultAdminRoute,
  hasModuleAccess,
} from "@dashboard/lib/rbac";
import { Loader2 } from "lucide-react";

interface RoleRouteProps {
  module: AdminModule;
  children: React.ReactNode;
}

function ModuleGateSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
      <p className="text-sm">Cargando módulo…</p>
    </div>
  );
}

/**
 * Guards a single admin module. Waits for profile (or optimistic cache) before
 * redirecting away — avoids bounce while profile is still loading.
 */
export function RoleRoute({ module, children }: RoleRouteProps) {
  const { profile, profileLoading } = useAuth();

  if (profileLoading && !profile) {
    return <ModuleGateSkeleton />;
  }

  if (!hasModuleAccess(profile ?? undefined, module)) {
    return <Navigate to={getDefaultAdminRoute(profile ?? undefined)} replace />;
  }

  return <>{children}</>;
}
