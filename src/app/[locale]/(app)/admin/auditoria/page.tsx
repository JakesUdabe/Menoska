"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";
import { useAuth } from "@/components/auth-provider";
import { listAuditEvents, type AuditEvent } from "@/lib/audit-store";
import { isSuperAdmin } from "@/lib/rbac";

export default function AdminAuditoriaPage() {
  const t = useT();
  const { user } = useAuth();
  const [events, setEvents] = useState<AuditEvent[]>([]);

  useEffect(() => {
    let cancelled = false;
    void listAuditEvents({
      organizationId: isSuperAdmin(user?.role) ? undefined : user?.organizationId,
      limit: 100,
    }).then((rows) => {
      if (!cancelled) setEvents(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.role, user?.organizationId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">{t("admin.audit")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("admin.auditLead")}</p>
      </div>
      {events.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          {t("admin.auditEmpty")}
        </p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {events.map((e) => (
            <li key={e.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{e.title}</span>
                <time className="font-mono text-xs text-muted-foreground" dateTime={e.createdAt}>
                  {new Date(e.createdAt).toLocaleString()}
                </time>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="font-mono">{e.kind}</span>
                {e.userId ? ` · actor ${e.userId.slice(0, 8)}…` : null}
                {e.organizationId ? ` · org ${e.organizationId}` : null}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
