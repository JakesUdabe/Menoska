"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { useT } from "@/i18n/provider";
import { createReferralCode, listReferralCodes, type ReferralCode } from "@/lib/partners/referral-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function PartnersDashboardPage() {
  const t = useT();
  const { user } = useAuth();
  const [codes, setCodes] = useState<ReferralCode[]>([]);
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (user?.organizationId) {
      setCodes(listReferralCodes(user.organizationId));
    }
  }, [user?.organizationId]);

  function onCreate() {
    if (!user?.organizationId || !label.trim()) {
      toast.error(t("partnerPortal.required"));
      return;
    }
    const code = createReferralCode({ organizationId: user.organizationId, label: label.trim() });
    setCodes(listReferralCodes(user.organizationId));
    setLabel("");
    toast.success(`${t("partnerPortal.created")}: ${code.code}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">{t("partnerPortal.eyebrow")}</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">{t("partnerPortal.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("partnerPortal.lead")}</p>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-card p-5">
        <div>
          <Label htmlFor="label">{t("partnerPortal.label")}</Label>
          <Input id="label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Boutique IB Madrid" />
        </div>
        <Button type="button" onClick={onCreate}>
          {t("partnerPortal.create")}
        </Button>
      </div>

      <ul className="space-y-2">
        {codes.length === 0 ? (
          <li className="text-sm text-muted-foreground">{t("partnerPortal.empty")}</li>
        ) : (
          codes.map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm">
              <div>
                <p className="font-mono font-semibold text-primary">{c.code}</p>
                <p className="text-muted-foreground">{c.label}</p>
              </div>
              <p className="font-mono text-xs text-muted-foreground">
                {c.clicks} {t("partnerPortal.clicks")}
              </p>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
