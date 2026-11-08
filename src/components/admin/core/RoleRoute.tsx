"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useLocale, useT } from "@/i18n/provider";
import {
  getDefaultAdminRoute,
  hasModuleAccess,
  type AdminModule,
} from "@/lib/admin/rbac";
import { withLocale } from "@/lib/paths";

export function RoleRoute({ module, children }: { module: AdminModule; children: ReactNode }) {
  const { user, loading } = useAuth();
  const { locale } = useLocale();
  const t = useT();
  const router = useRouter();
  const permissions = user?.employeePermissions;
  const allowed = hasModuleAccess(
    user ? { role: user.role, employee_permissions: permissions } : null,
    module,
  );

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(withLocale(locale, "/login"));
      return;
    }
    if (!allowed) {
      router.replace(
        withLocale(
          locale,
          getDefaultAdminRoute({ role: user.role, employee_permissions: user.employeePermissions }),
        ),
      );
    }
  }, [allowed, loading, locale, router, user]);

  if (loading || !user || !allowed) {
    return <div className="p-8 text-sm text-muted-foreground">{t("common.loading")}</div>;
  }

  return children;
}
