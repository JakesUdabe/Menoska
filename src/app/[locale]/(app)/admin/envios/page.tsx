"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";
import { DEMO_SEND_CALENDAR } from "@/lib/demo-data";
import { listBulletinsForUser } from "@/lib/bulletins-repository";
import { listBulletinDeliveries } from "@/lib/bulletin-deliveries-repository";
import { useAuth } from "@/components/auth-provider";
import { isSuperAdmin } from "@/lib/rbac";

function weekday(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type CalendarEvent = { id: string; org: string; bulletin: string; when: string; status: string };

export default function AdminEnviosPage() {
  const t = useT();
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [fromStore, deliveryRows] = await Promise.all([
        user
          ? listBulletinsForUser(user.id, user.organizationId, true).then((rows) =>
              rows.map((b) => ({
                id: `store-${b.id}`,
                org: user.organizationName ?? "",
                bulletin: b.name,
                when: `2026-09-22T${String(b.sendHour).padStart(2, "0")}:00:00Z`,
                status: b.status,
              })),
            )
          : Promise.resolve([] as CalendarEvent[]),
        listBulletinDeliveries(),
      ]);
      if (cancelled) return;
      const deliveries = deliveryRows.map((d) => ({
        id: `del-${d.id}`,
        org: d.org || user?.organizationName || "",
        bulletin: d.bulletinName,
        when: d.when,
        status: d.demo ? "demo-sent" : d.status,
      }));
      const base = isSuperAdmin(user?.role)
        ? DEMO_SEND_CALENDAR
        : DEMO_SEND_CALENDAR.filter((s) => s.org === user?.organizationName);
      setEvents([...deliveries, ...fromStore, ...base]);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div>
      <h1 className="font-display text-3xl font-bold tracking-tight">{t("admin.calendar")}</h1>
      <ol className="mt-6 space-y-3">
        {events.map((s) => (
          <li key={s.id} className="flex items-center justify-between rounded-xl border p-4 text-sm">
            <div>
              <p className="font-medium">{s.bulletin}</p>
              <p className="text-muted-foreground">
                {s.org} · {s.status}
              </p>
            </div>
            <time className="text-muted-foreground">{weekday(s.when)}</time>
          </li>
        ))}
      </ol>
    </div>
  );
}
