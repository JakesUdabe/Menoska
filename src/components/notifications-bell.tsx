"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { listRecentActivity, type ActivityEvent } from "@/lib/activity";
import { listNotifications } from "@/lib/notifications-store";
import { writeStorage } from "@/lib/storage-keys";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const READ_KEY = "menoska_notifications_read";

function loadReadIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(READ_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeIds(ids: string[]) {
  writeStorage(READ_KEY, JSON.stringify(ids.slice(0, 50)));
}

export function NotificationsBell() {
  const t = useT();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ActivityEvent[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    const events = await listRecentActivity({
      organizationId: user.organizationId,
      userId: user.id,
      limit: 8,
    });
    const extras = listNotifications({
      organizationId: user.organizationId,
      userId: user.id,
      limit: 5,
    }).map(
      (n): ActivityEvent => ({
        id: n.id,
        organizationId: n.organizationId,
        userId: n.userId,
        kind: n.kind,
        title: n.title,
        meta: { body: n.body },
        createdAt: n.createdAt,
      }),
    );
    const byId = new Map<string, ActivityEvent>();
    for (const e of [...extras, ...events]) byId.set(e.id, e);
    setItems(
      [...byId.values()]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 8),
    );
    setReadIds(loadReadIds());
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const unread = items.filter((i) => !readIds.includes(i.id)).length;

  function markAllRead() {
    const ids = [...new Set([...readIds, ...items.map((i) => i.id)])];
    writeIds(ids);
    setReadIds(ids);
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        aria-label={t("notifications.title")}
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void load();
        }}
      >
        <Bell className="size-5" />
        {unread > 0 ? (
          <span className="absolute right-1 top-1 size-2 rounded-full bg-primary" aria-hidden />
        ) : null}
      </button>
      {open ? (
        <>
          <button type="button" className="fixed inset-0 z-40 cursor-default" aria-label="Close" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border bg-card p-3 shadow-lg">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">{t("notifications.title")}</p>
              <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={markAllRead}>
                {t("notifications.markRead")}
              </button>
            </div>
            {items.length === 0 ? (
              <p className="px-1 py-4 text-center text-xs text-muted-foreground">{t("notifications.empty")}</p>
            ) : (
              <ul className="max-h-72 space-y-1 overflow-y-auto">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className={cn(
                      "rounded-lg px-2 py-2 text-xs",
                      readIds.includes(item.id) ? "text-muted-foreground" : "bg-accent/40 text-foreground",
                    )}
                  >
                    <p className="font-medium">{item.title}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {item.kind} · {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
