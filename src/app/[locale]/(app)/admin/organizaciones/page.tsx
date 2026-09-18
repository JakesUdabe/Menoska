"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "@/i18n/provider";
import { DEMO_PROFILES } from "@/lib/demo-data";
import { listOrgs, splitOrganization } from "@/lib/orgs-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { isSuperAdmin } from "@/lib/rbac";

export default function AdminOrgsPage() {
  const t = useT();
  const { user } = useAuth();
  const [orgs, setOrgs] = useState<ReturnType<typeof listOrgs>>([]);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [source, setSource] = useState(user?.organizationId ?? "");

  useEffect(() => {
    const loaded = listOrgs();
    setOrgs(loaded);
    setSource((prev) => prev || user?.organizationId || loaded[0]?.id || "");
  }, [user?.organizationId]);

  const visible = useMemo(() => {
    if (isSuperAdmin(user?.role)) return orgs;
    return orgs.filter((o) => o.id === user?.organizationId);
  }, [orgs, user]);

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-bold tracking-tight">{t("admin.orgs")}</h1>
      <ul className="space-y-3">
        {visible.map((o) => (
          <li key={o.id} className="rounded-xl border p-4">
            <p className="font-medium">{o.name}</p>
            <p className="text-sm text-muted-foreground">
              @{o.domain} · {o.plan} · {o.status}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("admin.users")} {DEMO_PROFILES.filter((p) => p.organizationId === o.id).map((p) => p.email).join(", ") || "—"}
            </p>
          </li>
        ))}
      </ul>

      {isSuperAdmin(user?.role) || user?.role === "admin" ? (
        <section className="rounded-xl border p-4">
          <h2 className="font-semibold">{t("admin.split")}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <Label>{t("admin.newOrgName")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>{t("admin.newDomain")}</Label>
              <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="nuevaempresa.com" />
            </div>
          </div>
          <Button
            className="mt-4"
            onClick={() => {
              if (!name || !domain) return;
              const created = splitOrganization(source, name, domain);
              setOrgs(listOrgs());
              setSource(created.id);
              toast.success(created.name);
              setName("");
              setDomain("");
            }}
          >
            {t("admin.split")}
          </Button>
        </section>
      ) : null}
    </div>
  );
}
