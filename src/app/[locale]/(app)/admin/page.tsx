"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";
import { DEMO_PROFILES, DEMO_SEND_CALENDAR } from "@/lib/demo-data";
import { listOrgs } from "@/lib/orgs-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminHomePage() {
  const t = useT();
  const [orgCount, setOrgCount] = useState(0);

  useEffect(() => {
    setOrgCount(listOrgs().length);
  }, []);

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-bold tracking-tight">{t("admin.title")}</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("admin.orgs")}</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{orgCount}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("admin.users")}</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{DEMO_PROFILES.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("admin.metrics")}</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">1,2 M</CardContent>
        </Card>
      </div>
      <section>
        <h2 className="mb-3 font-semibold">{t("admin.users")}</h2>
        <ul className="divide-y rounded-xl border">
          {DEMO_PROFILES.map((p) => (
            <li key={p.id} className="flex justify-between px-4 py-3 text-sm">
              <span>{p.fullName}</span>
              <span className="text-muted-foreground">
                {p.role} · {p.organizationName}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-3 font-semibold">{t("admin.calendar")}</h2>
        <ul className="space-y-2">
          {DEMO_SEND_CALENDAR.map((s) => (
            <li key={s.id} className="rounded-lg border px-4 py-3 text-sm">
              {s.when} · {s.org} · {s.bulletin}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
