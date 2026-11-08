import type { PlanType, SessionRole } from "@/lib/rbac";
import { getQuotaOverride } from "@/lib/quota-overrides";

/** Headers for demo-mode API auth (ignored when Supabase session cookies are present). */
export function demoApiHeaders(
  user: { id: string; plan: PlanType; role?: SessionRole; organizationId?: string | null } | null | undefined,
): Record<string, string> {
  if (!user) return {};
  const headers: Record<string, string> = {
    "x-demo-user-id": user.id,
    "x-demo-plan": user.plan,
  };
  if (user.role) headers["x-demo-role"] = user.role;
  if (user.organizationId) headers["x-demo-org-id"] = user.organizationId;
  try {
    const extra = getQuotaOverride(user.organizationId)?.extraAi ?? 0;
    if (extra > 0) headers["x-demo-extra-ai"] = String(extra);
  } catch {
    /* SSR / no window */
  }
  return headers;
}
