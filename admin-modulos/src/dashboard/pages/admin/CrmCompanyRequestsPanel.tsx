import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@dashboard/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dashboard/components/ui/card";
import { Badge } from "@dashboard/components/ui/badge";
import type { CrmCompanyRequest } from "@dashboard/lib/crmCompanyAccess";

export function CrmCompanyRequestsPanel({
  requests,
  loading,
  comercialLabel,
  onResolve,
  resolvingId,
}: {
  requests: CrmCompanyRequest[];
  loading: boolean;
  comercialLabel: (id: string) => string;
  onResolve: (requestId: string, approve: boolean) => void;
  resolvingId: string | null;
}) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="min-h-[70vh]">
      <CardHeader>
        <CardTitle>{t("admin.crm.companyRequestsTitle")}</CardTitle>
        <CardDescription>{t("admin.crm.companyRequestsTabDesc")}</CardDescription>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-16">{t("admin.crm.companyRequestsEmpty")}</p>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => {
              const busy = resolvingId === req.id;
              return (
                <div
                  key={req.id}
                  className="rounded-lg border p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-lg">{req.company_name}</p>
                      <Badge variant="outline">{t("admin.crm.companyRequestPendingShort")}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t("admin.crm.companyRequestFrom", { name: comercialLabel(req.requester_id) })}
                    </p>
                    {req.message ? (
                      <p className="text-sm whitespace-pre-wrap rounded-md bg-muted/40 p-3 border">
                        {req.message}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">{t("admin.crm.companyRequestNoMessage")}</p>
                    )}
                    <p className="text-xs text-muted-foreground font-mono">{req.company_key}</p>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0 sm:min-w-[140px]">
                    <Button disabled={busy} onClick={() => onResolve(req.id, true)}>
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : t("admin.crm.companyRequestApprove")}
                    </Button>
                    <Button variant="outline" disabled={busy} onClick={() => onResolve(req.id, false)}>
                      {t("admin.crm.companyRequestReject")}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
