"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";
import { listOrgs, type DemoOrg } from "@/lib/orgs-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/components/auth-provider";
import { isSuperAdmin } from "@/lib/rbac";

export default function AdminBillingPage() {
  const t = useT();
  const { user } = useAuth();
  const [orgs, setOrgs] = useState<DemoOrg[]>([]);

  useEffect(() => {
    const all = listOrgs();
    setOrgs(isSuperAdmin(user?.role) ? all : all.filter((o) => o.id === user?.organizationId));
  }, [user]);

  const mrr = orgs.reduce((s, o) => s + o.mrr, 0);

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-bold tracking-tight">{t("admin.billing")}</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("admin.mrr")}</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{mrr.toLocaleString("es-ES")} €</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("admin.orgs")}</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{orgs.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("admin.aiCost")}</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">412 €</CardContent>
        </Card>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("admin.orgs")}</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>{t("admin.mrr")}</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orgs.map((o) => (
            <TableRow key={o.id}>
              <TableCell>
                {o.name}
                <span className="block text-xs text-muted-foreground">@{o.domain}</span>
              </TableCell>
              <TableCell className="uppercase">{o.plan}</TableCell>
              <TableCell>{o.mrr} €</TableCell>
              <TableCell>{o.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
