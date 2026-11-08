/**
 * Internal admin RBAC for Menoska Consulting.
 * Superadmin is the destination role `superadmin` (not Proposalyze's `admin`).
 * Org admins stay `admin` and do not enter these modules.
 */

export type StaffRole = "superadmin" | "empleado";

export type AdminModule = "crm" | "finanzas" | "calendario" | "documentos" | "empleados";

export type EmployeePermissionKey = "crm" | "finanzas" | "calendario" | "documentos";

export type EmployeePermissions = Partial<Record<EmployeePermissionKey, boolean>>;

export const STAFF_ROLES: readonly StaffRole[] = ["superadmin", "empleado"] as const;

/** Menu order. First item is the /admin landing for whoever can see it. */
export const ADMIN_MODULES: readonly AdminModule[] = [
  "crm",
  "finanzas",
  "calendario",
  "documentos",
  "empleados",
] as const;

/** Keys the superadmin can toggle. Must match sanitize_employee_permissions. */
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
};

export function normalizeEmployeePermissions(raw: unknown): Record<EmployeePermissionKey, boolean> {
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
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
  return role === "superadmin";
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
    typeof roleOrProfile === "string" || roleOrProfile == null ? roleOrProfile : roleOrProfile.role;
  const permissions =
    typeof roleOrProfile === "object" && roleOrProfile ? roleOrProfile.employee_permissions : undefined;

  if (!role || !isStaffRole(role)) return false;
  if (role === "superadmin") return true;
  if (module === "empleados") return false;
  const perms = normalizeEmployeePermissions(permissions);
  return Boolean(perms[module]);
}

export function getAccessibleModules(roleOrProfile: string | RbacProfile | null | undefined): AdminModule[] {
  return ADMIN_MODULES.filter((m) => hasModuleAccess(roleOrProfile, m));
}

export function getDefaultAdminRoute(roleOrProfile: string | RbacProfile | null | undefined): string {
  const modules = getAccessibleModules(roleOrProfile);
  if (modules.length === 0) return "/dashboard";
  return MODULE_ROUTES[modules[0]];
}
