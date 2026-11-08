"use client";

import { useEffect, useState } from "react";
import { Shield, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { useT } from "@/i18n/provider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { writeStorage, readMigratedStorage } from "@/lib/storage-keys";

const KEY = "menoska_sso_config";

type SsoStub = {
  entityId: string;
  metadataXml: string;
  updatedAt: string;
};

type HealthFlags = {
  ok?: boolean;
  demo?: boolean;
  stripe?: boolean;
  resend?: boolean;
  supabase?: boolean;
  ai?: boolean;
  patents?: boolean;
};

function StatusRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {ok ? <CheckCircle2 className="size-4 shrink-0 text-primary" /> : <XCircle className="size-4 shrink-0 text-muted-foreground" />}
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </li>
  );
}

export default function SeguridadPage() {
  const t = useT();
  const { user } = useAuth();
  const [entityId, setEntityId] = useState("");
  const [metadataXml, setMetadataXml] = useState("");
  const [saved, setSaved] = useState<SsoStub | null>(null);
  const [health, setHealth] = useState<HealthFlags | null>(null);
  const isEnterprise = user?.plan === "enterprise";

  useEffect(() => {
    try {
      const raw = readMigratedStorage(KEY, "abi_sso_config");
      if (raw) {
        const parsed = JSON.parse(raw) as SsoStub;
        setSaved(parsed);
        setEntityId(parsed.entityId);
        setMetadataXml(parsed.metadataXml);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void fetch("/api/health")
      .then((r) => r.json())
      .then((data: HealthFlags) => setHealth(data))
      .catch(() => setHealth(null));
  }, []);

  function save() {
    const stub: SsoStub = {
      entityId: entityId.trim(),
      metadataXml: metadataXml.trim(),
      updatedAt: new Date().toISOString(),
    };
    writeStorage(KEY, JSON.stringify(stub));
    setSaved(stub);
    toast.message(isEnterprise ? t("seguridad.saved") : t("seguridad.enterpriseRequired"));
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">{t("seguridad.eyebrow")}</p>
        <h1 className="mt-1 flex items-center gap-2 font-display text-3xl font-bold tracking-tight">
          <Shield className="size-7 text-primary" />
          {t("seguridad.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("seguridad.lead")}</p>
      </div>

      {!isEnterprise ? (
        <div className="rounded-xl border border-dashed border-primary/40 bg-primary/[0.04] px-4 py-3 text-sm text-muted-foreground">
          {t("seguridad.enterpriseRequired")}
        </div>
      ) : null}

      <div className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div>
          <Label htmlFor="entity">{t("seguridad.entityId")}</Label>
          <input
            id="entity"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            placeholder="https://idp.ejemplo.com/entity"
          />
        </div>
        <div>
          <Label htmlFor="meta">{t("seguridad.metadata")}</Label>
          <textarea
            id="meta"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
            rows={8}
            value={metadataXml}
            onChange={(e) => setMetadataXml(e.target.value)}
            placeholder="<?xml version=&quot;1.0&quot;?>…"
          />
        </div>
        <Button type="button" onClick={save}>
          {t("seguridad.save")}
        </Button>
        {saved ? (
          <p className="text-xs text-muted-foreground">
            {t("seguridad.lastSaved")}: {saved.updatedAt}
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-border p-5 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">{t("seguridad.scimTitle")}</p>
        <p className="mt-2">{t("seguridad.scimBody")}</p>
        <code className="mt-2 block font-mono text-xs text-primary">GET|POST /api/scim/v2/Users → 501</code>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <p className="font-medium text-foreground">{t("seguridad.prodChecklist")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("seguridad.prodChecklistLead")}</p>
        <ul className="mt-4 space-y-2">
          <StatusRow ok={Boolean(health?.supabase)} label={t("seguridad.flagSupabase")} />
          <StatusRow ok={Boolean(health?.stripe)} label={t("seguridad.flagStripe")} />
          <StatusRow ok={Boolean(health?.resend)} label={t("seguridad.flagResend")} />
          <StatusRow ok={Boolean(health?.ai)} label={t("seguridad.flagAi")} />
          <StatusRow ok={Boolean(health?.patents)} label={t("seguridad.flagPatents")} />
          <StatusRow ok={health?.demo === false} label={t("seguridad.flagNotDemo")} />
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          {t("seguridad.redirectsHint")}{" "}
          <code className="font-mono text-[10px]">/auth/callback</code>,{" "}
          <code className="font-mono text-[10px]">/[locale]/nueva-contrasena</code> — docs/HITO1_CHECKLIST.md
        </p>
      </div>
    </div>
  );
}
