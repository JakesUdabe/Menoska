"use client";

import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, NavLink, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { CalendarDays, DollarSign, FolderOpen, Settings, UserCog, Users, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Toaster } from "sonner";
import { useLocale } from "@/components/locale";
import { AuthProvider, useAuth } from "@/dashboard/contexts/AuthContext";
import { RoleRoute } from "@/dashboard/components/RoleRoute";
import {
  type AdminModule,
  getAccessibleModules,
  getDefaultAdminRoute,
  MODULE_ROUTES,
} from "@/dashboard/lib/rbac";
import { cn } from "@/dashboard/lib/utils";
import AdminCalendarioPage from "@/dashboard/pages/admin/AdminCalendarioPage";
import AdminCrmPage from "@/dashboard/pages/admin/AdminCrmPage";
import AdminDocumentosPage from "@/dashboard/pages/admin/AdminDocumentosPage";
import AdminContenidoPage from "@/dashboard/pages/admin/AdminContenidoPage";
import AdminEmpleadosPage from "@/dashboard/pages/admin/AdminEmpleadosPage";
import AdminFinanzasPage from "@/dashboard/pages/admin/AdminFinanzasPage";
import "@/dashboard/i18n";
import i18n from "@/dashboard/i18n";
import "./admin.css";

const ICONS: Record<AdminModule, typeof Users> = {
  crm: Users,
  finanzas: DollarSign,
  calendario: CalendarDays,
  documentos: FolderOpen,
  empleados: UserCog,
  contenido: Settings,
};

function ModuleSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p className="text-sm">Cargando módulo…</p>
    </div>
  );
}

function I18nSync({ children }: { children: React.ReactNode }) {
  const { locale } = useLocale();
  useEffect(() => {
    void i18n.changeLanguage(locale);
  }, [locale]);
  return children;
}

function AdminIndex() {
  const { profile, profileLoading } = useAuth();
  if (profileLoading && !profile) return <ModuleSkeleton />;
  const modules = getAccessibleModules(profile ?? undefined);
  if (modules.length === 0) {
    return <p className="text-sm text-muted-foreground">No tienes módulos asignados.</p>;
  }
  return <Navigate to={getDefaultAdminRoute(profile ?? undefined)} replace />;
}

function AdminLayout() {
  const { t } = useTranslation();
  const { profile, profileLoading, signOut, user } = useAuth();
  const location = useLocation();
  const ready = Boolean(profile) || !profileLoading;
  const modules = ready ? getAccessibleModules(profile ?? undefined) : [];

  useEffect(() => {
    if (profileLoading) return;
    if (!user) {
      window.location.assign("/acceso/");
      return;
    }
    if (profile && profile.role !== "admin" && profile.role !== "empleado") {
      window.location.assign("/app/");
    }
  }, [profile, profileLoading, user]);

  return (
    <div className="admin-root flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card">
        <div className="px-4 py-5">
          <p className="text-sm font-semibold">{t("admin.brand")}</p>
          <p className="text-xs text-muted-foreground">{t("admin.brandAdmin")}</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-2">
          {profileLoading && !profile ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Cargando…</p>
          ) : (
            modules.map((module) => {
              const Icon = ICONS[module];
              const href = MODULE_ROUTES[module];
              const active = location.pathname.replace(/\/$/, "") === href;
              return (
                <NavLink
                  key={module}
                  to={href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm",
                    active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t(`admin.modules.${module}`)}
                </NavLink>
              );
            })
          )}
        </nav>
        <button type="button" onClick={() => void signOut()} className="m-3 text-left text-sm text-muted-foreground">
          {t("admin.logout")}
        </button>
      </aside>
      <main className="min-w-0 flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}

function AdminRoutes() {
  return (
    <Routes>
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminIndex />} />
        <Route path="calendario" element={<RoleRoute module="calendario"><AdminCalendarioPage /></RoleRoute>} />
        <Route path="finanzas" element={<RoleRoute module="finanzas"><AdminFinanzasPage /></RoleRoute>} />
        <Route path="crm" element={<RoleRoute module="crm"><AdminCrmPage /></RoleRoute>} />
        <Route path="documentos" element={<RoleRoute module="documentos"><AdminDocumentosPage /></RoleRoute>} />
        <Route path="empleados" element={<RoleRoute module="empleados"><AdminEmpleadosPage /></RoleRoute>} />
        <Route path="contenido" element={<RoleRoute module="contenido"><AdminContenidoPage /></RoleRoute>} />
      </Route>
    </Routes>
  );
}

export function AdminApp() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const path = window.location.pathname;
    if (path.length > 1 && path.endsWith("/")) {
      window.history.replaceState(null, "", path.replace(/\/+$/, "") + window.location.search + window.location.hash);
    }
    setMounted(true);
  }, []);
  if (!mounted) {
    return (
      <div className="admin-root">
        <ModuleSkeleton />
      </div>
    );
  }
  return (
    <BrowserRouter>
      <AuthProvider>
        <I18nSync>
          <Toaster position="top-right" />
          <AdminRoutes />
        </I18nSync>
      </AuthProvider>
    </BrowserRouter>
  );
}
