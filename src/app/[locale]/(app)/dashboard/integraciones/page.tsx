"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Webhook, KeyRound } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useT } from "@/i18n/provider";
import { demoApiHeaders } from "@/lib/api/demo-headers";
import { isOrgAdmin } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type WebhookRow = {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
  hasSecret?: boolean;
};

type KeyRow = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  active: boolean;
};

export default function IntegracionesPage() {
  const t = useT();
  const { user } = useAuth();
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [url, setUrl] = useState("https://example.com/hooks/menoska");
  const [secret, setSecret] = useState("");
  const [keyName, setKeyName] = useState("default");
  const [lastRawKey, setLastRawKey] = useState<string | null>(null);
  const canManage = isOrgAdmin(user?.role);

  const load = useCallback(async () => {
    if (!user || !canManage) return;
    const headers = demoApiHeaders(user);
    const [wh, ak] = await Promise.all([
      fetch("/api/v1/webhooks", { headers }).then((r) => r.json()).catch(() => ({ items: [] })),
      fetch("/api/v1/keys", { headers }).then((r) => r.json()).catch(() => ({ items: [] })),
    ]);
    setWebhooks(Array.isArray(wh.items) ? wh.items : []);
    setKeys(Array.isArray(ak.items) ? ak.items : []);
  }, [user, canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createWebhook() {
    if (!user) return;
    const res = await fetch("/api/v1/webhooks", {
      method: "POST",
      headers: { "content-type": "application/json", ...demoApiHeaders(user) },
      body: JSON.stringify({
        url: url.trim(),
        secret: secret.trim() || undefined,
        events: ["bulletin.sent"],
      }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok) {
      toast.error(data.error ?? t("integraciones.error"));
      return;
    }
    toast.success(t("integraciones.webhookCreated"));
    setSecret("");
    void load();
  }

  async function deleteWebhook(id: string) {
    if (!user) return;
    const res = await fetch(`/api/v1/webhooks?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: demoApiHeaders(user),
    });
    if (!res.ok) {
      toast.error(t("integraciones.error"));
      return;
    }
    toast.message(t("integraciones.webhookDeleted"));
    void load();
  }

  async function createKey() {
    if (!user) return;
    const res = await fetch("/api/v1/keys", {
      method: "POST",
      headers: { "content-type": "application/json", ...demoApiHeaders(user) },
      body: JSON.stringify({ name: keyName.trim() || "default" }),
    });
    const data = (await res.json()) as { ok?: boolean; key?: string; error?: string };
    if (!res.ok || !data.key) {
      toast.error(data.error ?? t("integraciones.error"));
      return;
    }
    setLastRawKey(data.key);
    toast.success(t("integraciones.keyCreated"));
    void load();
  }

  async function revokeKey(id: string) {
    if (!user) return;
    const res = await fetch(`/api/v1/keys?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: demoApiHeaders(user),
    });
    if (!res.ok) {
      toast.error(t("integraciones.error"));
      return;
    }
    toast.message(t("integraciones.keyRevoked"));
    void load();
  }

  if (!canManage) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
        {t("integraciones.adminOnly")}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">{t("integraciones.eyebrow")}</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">{t("integraciones.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("integraciones.lead")}</p>
      </div>

      <section className="space-y-4 rounded-xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Webhook className="size-5 text-primary" />
          {t("integraciones.webhooks")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="wh-url">{t("integraciones.webhookUrl")}</Label>
            <Input id="wh-url" value={url} onChange={(e) => setUrl(e.target.value)} className="mt-1" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="wh-secret">{t("integraciones.webhookSecret")}</Label>
            <Input id="wh-secret" value={secret} onChange={(e) => setSecret(e.target.value)} className="mt-1" />
          </div>
        </div>
        <Button type="button" onClick={() => void createWebhook()}>
          {t("integraciones.createWebhook")}
        </Button>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {webhooks.length === 0 ? (
            <li className="px-3 py-4 text-sm text-muted-foreground">{t("integraciones.noWebhooks")}</li>
          ) : (
            webhooks.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 text-sm">
                <div>
                  <p className="font-mono text-xs">{w.url}</p>
                  <p className="text-xs text-muted-foreground">{w.events.join(", ")}</p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => void deleteWebhook(w.id)}>
                  {t("common.delete")}
                </Button>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <KeyRound className="size-5 text-primary" />
          {t("integraciones.apiKeys")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("integraciones.apiKeysHint")}</p>
        <div>
          <Label htmlFor="key-name">{t("integraciones.keyName")}</Label>
          <Input id="key-name" value={keyName} onChange={(e) => setKeyName(e.target.value)} className="mt-1 max-w-xs" />
        </div>
        <Button type="button" onClick={() => void createKey()}>
          {t("integraciones.createKey")}
        </Button>
        {lastRawKey ? (
          <div className="rounded-lg border border-amber-600/40 bg-amber-50/50 p-3 text-xs dark:bg-amber-950/20">
            <p className="font-medium">{t("integraciones.copyKey")}</p>
            <code className="mt-2 block break-all font-mono">{lastRawKey}</code>
          </div>
        ) : null}
        <ul className="divide-y divide-border rounded-lg border border-border">
          {keys.length === 0 ? (
            <li className="px-3 py-4 text-sm text-muted-foreground">{t("integraciones.noKeys")}</li>
          ) : (
            keys.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 text-sm">
                <div>
                  <p className="font-medium">{k.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{k.prefix}…</p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => void revokeKey(k.id)}>
                  {t("integraciones.revoke")}
                </Button>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
