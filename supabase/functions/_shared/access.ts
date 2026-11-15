/** Roles internos Proposalyze (staff / admin). */
const STAFF_ROLES = new Set(["admin", "empleado"]);
/** Roles legacy hasta aplicar migrate retire_legacy_admin_roles. */
const LEGACY_ADMIN_ROLES = new Set(["admin_1", "admin_2", "admin_3"]);

export function isStaffRole(role: string | null | undefined): boolean {
  return Boolean(role && (STAFF_ROLES.has(role) || LEGACY_ADMIN_ROLES.has(role)));
}

export function getTotalCredits(profile: {
  creditos_ia?: number | null;
  creditos_rewarded?: number | null;
} | null | undefined): number {
  return (profile?.creditos_ia ?? 0) + (profile?.creditos_rewarded ?? 0);
}

type StaffProfile = {
  role?: string | null;
  employee_permissions?: Record<string, unknown> | null;
  creditos_ia?: number | null;
  creditos_rewarded?: number | null;
};

function employeeHas(profile: StaffProfile, key: string): boolean {
  return profile.role === "empleado" && Boolean(profile.employee_permissions?.[key]);
}

/** Bypass créditos IA: admin (y legacy), o empleado con unlimited_ia. */
export function bypassesIaCredits(profile: StaffProfile | null | undefined): boolean {
  if (!profile?.role) return false;
  if (profile.role === "admin" || LEGACY_ADMIN_ROLES.has(profile.role)) return true;
  return employeeHas(profile, "unlimited_ia");
}

/**
 * Carga perfil para cobro/bypass. Si falta la columna employee_permissions
 * (migración no aplicada), reintenta solo con role + créditos.
 */
export async function loadProfileForIaCredits(
  // deno-lint-ignore no-explicit-any
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<StaffProfile> {
  const full = await supabase
    .from("profiles")
    .select("creditos_ia, creditos_rewarded, role, employee_permissions")
    .eq("user_id", userId)
    .single();

  if (!full.error && full.data) return full.data as StaffProfile;

  const msg = String(full.error?.message ?? "");
  if (/employee_permissions/i.test(msg) || full.error?.code === "42703") {
    const fallback = await supabase
      .from("profiles")
      .select("creditos_ia, creditos_rewarded, role")
      .eq("user_id", userId)
      .single();
    if (!fallback.error && fallback.data) {
      return { ...(fallback.data as StaffProfile), employee_permissions: {} };
    }
    throw new Error(
      `Perfil no encontrado para verificar créditos: ${fallback.error?.message ?? "sin datos"}`,
    );
  }

  throw new Error(
    `Perfil no encontrado para verificar créditos: ${full.error?.message ?? "sin datos"}`,
  );
}

/** Acceso a finanzas (Stripe / OpenAI costs). */
export function hasFinanceAccess(profile: StaffProfile | null | undefined): boolean {
  if (!profile?.role) return false;
  if (profile.role === "admin" || LEGACY_ADMIN_ROLES.has(profile.role)) return true;
  return employeeHas(profile, "finanzas");
}

/** Acceso a CRM. */
export function hasCrmAccess(profile: StaffProfile | null | undefined): boolean {
  if (!profile?.role) return false;
  if (profile.role === "admin" || LEGACY_ADMIN_ROLES.has(profile.role)) return true;
  return employeeHas(profile, "crm");
}

/** Acceso a gestión de convocatorias (embeddings sync, etc.). */
export function hasConvocatoriasAccess(profile: StaffProfile | null | undefined): boolean {
  if (!profile?.role) return false;
  if (profile.role === "admin" || LEGACY_ADMIN_ROLES.has(profile.role)) return true;
  return employeeHas(profile, "convocatorias");
}
