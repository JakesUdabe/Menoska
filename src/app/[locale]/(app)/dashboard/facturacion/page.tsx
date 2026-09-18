"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { countActiveBulletins } from "@/lib/bulletins-store";
import { maxActiveBulletins, maxUsersPerOrg } from "@/lib/rbac";
import { DEMO_PROFILES } from "@/lib/demo-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function BillingPage() {
  const t = useT();
  const { user } = useAuth();
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (user) setActive(countActiveBulletins(user.id));
  }, [user]);

  const bulletinCap = maxActiveBulletins(user?.plan);
  const userCap = maxUsersPerOrg(user?.plan);
  const orgUsers = DEMO_PROFILES.filter((p) => p.organizationId === user?.organizationId).length;

  async function checkout(plan: "starter" | "business" | "enterprise") {
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const data = (await res.json()) as { url?: string; error?: string };
    if (data.url) window.location.href = data.url;
    else toast.error(data.error ?? t("billing.demoStripe"));
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-display text-3xl font-bold tracking-tight">{t("dashboard.billing")}</h1>
      <p className="text-sm text-muted-foreground">
        {t("billing.current")} <strong className="uppercase">{user?.plan}</strong>
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("billing.bulletinsUsed")}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {active} / {bulletinCap ?? "∞"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("billing.usersUsed")}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {orgUsers} / {userCap ?? "∞"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("billing.sends")}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">4</CardContent>
        </Card>
      </div>
      <p className="text-sm text-muted-foreground">{t("billing.portalNote")}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant={user?.plan === "starter" ? "default" : "outline"} onClick={() => void checkout("starter")}>
          Starter
        </Button>
        <Button variant={user?.plan === "business" ? "default" : "outline"} onClick={() => void checkout("business")}>
          {t("billing.upgrade")} · Business
        </Button>
        <Button variant={user?.plan === "enterprise" ? "default" : "outline"} onClick={() => void checkout("enterprise")}>
          Enterprise
        </Button>
      </div>
    </div>
  );
}
