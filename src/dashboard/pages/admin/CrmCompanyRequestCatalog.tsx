import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/dashboard/components/ui/button";
import { Input } from "@/dashboard/components/ui/input";
import { Label } from "@/dashboard/components/ui/label";
import { Textarea } from "@/dashboard/components/ui/textarea";
import { Checkbox } from "@/dashboard/components/ui/checkbox";
import {
  fetchCompanyCatalog,
  requestCompaniesBatch,
  type CrmCompanySearchRow,
} from "@/dashboard/lib/crmCompanyAccess";
import { cn } from "@/dashboard/lib/utils";

const PAGE_SIZE = 50;
const BATCH_MAX = 10;

export function CrmCompanyRequestCatalog({
  currentUserId,
  pendingKeys,
  onRequested,
  onBack,
}: {
  currentUserId: string;
  pendingKeys: Set<string>;
  onRequested: () => void;
  onBack?: () => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<CrmCompanySearchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Map<string, string>>(() => new Map());

  useEffect(() => {
    const h = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(h);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { rows: catalogRows, total: catalogTotal } = await fetchCompanyCatalog({
        query: debouncedQuery,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      });
      setRows(catalogRows);
      setTotal(catalogTotal);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.crm.loadError"));
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, page, t]);

  useEffect(() => { void load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const toggleRow = (row: CrmCompanySearchRow) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(row.company_key)) {
        next.delete(row.company_key);
        return next;
      }
      if (next.size >= BATCH_MAX) {
        toast.message(t("admin.crm.requestBatchMax", { max: BATCH_MAX }));
        return prev;
      }
      next.set(row.company_key, row.company_name);
      return next;
    });
  };

  const submitBatch = async () => {
    if (selected.size === 0) {
      toast.error(t("admin.crm.requestBatchSelectOne"));
      return;
    }
    if (!message.trim()) {
      toast.error(t("admin.crm.requestBatchMessageRequired"));
      return;
    }
    setBusy(true);
    try {
      const items = [...selected.entries()].map(([company_key, company_name]) => ({
        company_key,
        company_name,
      }));
      const { sent, skipped } = await requestCompaniesBatch(items, message.trim());
      toast.success(
        skipped > 0
          ? `${t("admin.crm.requestBatchSent", { count: sent })} · ${t("admin.crm.requestBatchSkippedNote", { count: skipped })}`
          : t("admin.crm.requestBatchSent", { count: sent }),
      );
      setSelected(new Map());
      setMessage("");
      onRequested();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.common.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-12rem)] flex-col gap-4 w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {onBack && (
            <Button type="button" variant="ghost" size="sm" className="-ml-2 mb-1 gap-1" onClick={onBack}>
              <ChevronLeft className="w-4 h-4" />
              {t("admin.crm.backToCompanies")}
            </Button>
          )}
          <h2 className="text-xl font-semibold tracking-tight">{t("admin.crm.requestCompanyTitle")}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t("admin.crm.requestCatalogDesc")}</p>
        </div>
        <div className="text-sm text-muted-foreground tabular-nums">
          {t("admin.crm.requestBatchSelected", { count: selected.size, max: BATCH_MAX })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px] flex-1 min-h-0">
        <div className="flex flex-col min-h-0 rounded-lg border bg-card">
          <div className="p-4 border-b flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                className="pl-8"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("admin.crm.requestCompanySearchPlaceholder")}
              />
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">
              {t("admin.crm.catalogTotal", { total })}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto min-h-[50vh]">
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-16">{t("admin.crm.noFilterResults")}</p>
            ) : (
              <ul className="divide-y">
                {rows.map((row) => {
                  const isMine = row.owner_id === currentUserId;
                  const isPending = pendingKeys.has(row.company_key);
                  const checked = selected.has(row.company_key);
                  const disabled = isMine || isPending || busy;
                  const ownerLabel = row.owner_name?.trim()
                    || (row.owner_id ? row.owner_id.slice(0, 8) : t("admin.crm.companyUnassigned"));
                  return (
                    <li
                      key={row.company_key}
                      className={cn(
                        "flex items-start gap-3 p-4 hover:bg-muted/30 transition-colors",
                        disabled && "opacity-60",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={() => { if (!disabled) toggleRow(row); }}
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{row.company_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {row.domain && <span className="font-mono">{row.domain}</span>}
                          {row.domain && " · "}
                          {t("admin.crm.companyContactsCount", { count: row.contact_count })}
                          {" · "}
                          {t("admin.crm.companyOwnedBy", { name: ownerLabel })}
                        </p>
                        {isPending && (
                          <p className="text-xs text-amber-600 mt-1">{t("admin.crm.companyRequestPending")}</p>
                        )}
                        {isMine && (
                          <p className="text-xs text-emerald-600 mt-1">{t("admin.crm.companyAlreadyYours")}</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 border-t px-4 py-3">
              <span className="text-xs text-muted-foreground">
                {t("admin.crm.page", { current: page, total: totalPages })}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-muted/20 p-4 space-y-4 h-fit lg:sticky lg:top-4">
          <div>
            <Label>{t("admin.crm.requestCompanyMessage")}</Label>
            <Textarea
              className="mt-1.5 min-h-[120px]"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("admin.crm.requestBatchMessagePlaceholder")}
            />
            <p className="text-xs text-muted-foreground mt-2">{t("admin.crm.requestBatchHint", { max: BATCH_MAX })}</p>
          </div>
          <Button
            type="button"
            className="w-full"
            disabled={busy || selected.size === 0}
            onClick={() => void submitBatch()}
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {t("admin.crm.requestBatchSubmit", { count: selected.size })}
          </Button>
        </div>
      </div>
    </div>
  );
}
