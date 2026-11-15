/** Roles internos del panel de administración */
export type StaffRole = "admin" | "empleado";

export type UserRole = StaffRole | "client" | "cliente" | "user";

export type AdminModule = "crm" | "finanzas" | "calendario" | "documentos" | "empleados" | "contenido";

/** Módulos con permisos granulares para empleados */
export type EmployeePermissionKey = "crm" | "finanzas" | "calendario" | "documentos";

export type EmployeePermissions = Partial<Record<EmployeePermissionKey, boolean>>;

export const STAFF_ROLES: readonly StaffRole[] = ["admin", "empleado"] as const;

/** Orden de nav admin. Solo los módulos montados en este producto. */
export const ADMIN_MODULES: readonly AdminModule[] = [
  "crm",
  "finanzas",
  "calendario",
  "documentos",
  "empleados",
  "contenido",
] as const;

/** Keys de permiso que el admin puede asignar a un empleado */
export const EMPLOYEE_ASSIGNABLE_PERMISSIONS: readonly EmployeePermissionKey[] = [
  "crm",
  "finanzas",
  "calendario",
  "documentos",
] as const;

export const EMPTY_EMPLOYEE_PERMISSIONS: Record<EmployeePermissionKey, boolean> = {
  crm: false,
  finanzas: false,
  calendario: false,
  documentos: false,
};

export const MODULE_ROUTES: Record<AdminModule, string> = {
  crm: "/admin/crm",
  finanzas: "/admin/finanzas",
  calendario: "/admin/calendario",
  documentos: "/admin/documentos",
  empleados: "/admin/empleados",
  contenido: "/admin/contenido",
};

export const MODULE_LABELS: Record<AdminModule, string> = {
  crm: "Clientes",
  finanzas: "Finanzas",
  calendario: "Calendario",
  documentos: "Documentos",
  empleados: "Empleados",
  contenido: "Admin",
};

export function normalizeEmployeePermissions(
  raw: unknown,
): Record<EmployeePermissionKey, boolean> {
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  return {
    crm: Boolean(src.crm),
    finanzas: Boolean(src.finanzas),
    calendario: Boolean(src.calendario),
    documentos: Boolean(src.documentos),
  };
}

export function isStaffRole(role: string | null | undefined): role is StaffRole {
  return STAFF_ROLES.includes(role as StaffRole);
}

export function isSuperAdmin(role: string | null | undefined): boolean {
  return role === "admin";
}

export function isEmployeeRole(role: string | null | undefined): boolean {
  return role === "empleado";
}

export interface RbacProfile {
  role?: string | null;
  employee_permissions?: EmployeePermissions | null;
}

export function hasModuleAccess(
  roleOrProfile: string | RbacProfile | null | undefined,
  module: AdminModule,
): boolean {
  const role =
    typeof roleOrProfile === "string" || roleOrProfile == null
      ? roleOrProfile
      : roleOrProfile.role;
  const permissions =
    typeof roleOrProfile === "object" && roleOrProfile
      ? roleOrProfile.employee_permissions
      : undefined;

  if (!role || !isStaffRole(role)) return false;
  if (role === "admin") return true;

  if (module === "empleados" || module === "contenido") return false;
  const perms = normalizeEmployeePermissions(permissions);
  if (module in perms) return Boolean(perms[module as EmployeePermissionKey]);
  return false;
}

export function getAccessibleModules(
  roleOrProfile: string | RbacProfile | null | undefined,
): AdminModule[] {
  return ADMIN_MODULES.filter((m) => hasModuleAccess(roleOrProfile, m));
}

export function getDefaultAdminRoute(
  roleOrProfile: string | RbacProfile | null | undefined,
): string {
  const modules = getAccessibleModules(roleOrProfile);
  if (modules.length === 0) return "/admin";
  return MODULE_ROUTES[modules[0]];
}

export function getStaffRoleLabel(role: StaffRole): string {
  const labels: Record<StaffRole, string> = {
    admin: "Superadmin",
    empleado: "Empleado",
  };
  return labels[role];
}

const LEGACY_ADMIN_ROLES = new Set(["admin_1", "admin_2", "admin_3"]);

export function hasUnlimitedIaAccess(profile: RbacProfile | null | undefined): boolean {
  if (!profile?.role) return false;
  if (profile.role === "admin" || LEGACY_ADMIN_ROLES.has(profile.role)) return true;
  return false;
}
