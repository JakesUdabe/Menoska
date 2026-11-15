import { useCallback, useEffect, useState } from "react";
import { Eye, Gift, Loader2, Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/dashboard/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/dashboard/components/ui/card";
import { Button } from "@/dashboard/components/ui/button";
import { Badge } from "@/dashboard/components/ui/badge";
import { Input } from "@/dashboard/components/ui/input";
import { Label } from "@/dashboard/components/ui/label";
import { Textarea } from "@/dashboard/components/ui/textarea";
import { Checkbox } from "@/dashboard/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/dashboard/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/dashboard/components/ui/dialog";
import type {
  ClienteProfileHit,
  CreditReward,
  CrmRewardKind,
  CrmRewardListItem,
  FeatureAccessReward,
} from "@/dashboard/types/admin";
import { cn } from "@/dashboard/lib/utils";

const STAFF_ROLES = ["admin", "empleado"];

type RecipientInfo = NonNullable<CreditReward["recipient"]>;

function recipientLabel(
  r: { recipient?: RecipientInfo | null; user_id: string },
  unknownLabel: string,
): string {
  const rec = r.recipient;
  if (!rec) return unknownLabel;
  return rec.full_name || rec.email || rec.company_name || unknownLabel;
}

function recipientSub(r: { recipient?: RecipientInfo | null; user_id: string }): string {
  const rec = r.recipient;
  if (!rec) return r.user_id;
  const parts = [rec.email, rec.company_name].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : r.user_id;
}

/** End of selected calendar day in local time → ISO for DB. */
function endOfLocalDayIso(dateYmd: string): string {
  const [y, m, d] = dateYmd.split("-").map(Number);
  if (!y || !m || !d) return "";
  const end = new Date(y, m - 1, d, 23, 59, 59, 999);
  return end.toISOString();
}

function defaultExpiresDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function searchPlatformUsers(query: string, limit = 12): Promise<ClienteProfileHit[]> {
  const q = query.trim();

  const { data: rpcData, error: rpcError } = await supabase.rpc("search_cliente_profiles", {
    p_query: q,
    p_limit: limit,
  });

  if (!rpcError && Array.isArray(rpcData)) {
    return rpcData as ClienteProfileHit[];
  }

  let profilesQuery = supabase
    .from("profiles")
    .select("id, full_name, company_name, role")
    .limit(80);

  if (q) {
    profilesQuery = profilesQuery.or(
      `full_name.ilike.%${q}%,company_name.ilike.%${q}%`,
    );
  }

  const { data: profiles, error: profilesError } = await profilesQuery;
  if (profilesError) {
    if (rpcError) throw rpcError;
    throw profilesError;
  }

  const rows = (profiles ?? [])
    .filter((p) => !STAFF_ROLES.includes(String((p as { role?: string }).role ?? "client")))
    .slice(0, limit) as {
      id: string;
      full_name: string | null;
      company_name: string | null;
    }[];

  return rows.map((p) => ({
    user_id: p.id,
    full_name: p.full_name ?? "",
    company_name: p.company_name ?? "",
    email: "",
  }));
}

async function enrichWithRecipients<T extends { user_id: string; recipient?: RecipientInfo | null }>(
  rows: T[],
): Promise<T[]> {
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  if (userIds.length === 0) return rows;

  const byId = new Map<string, RecipientInfo>();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, company_name")
    .in("id", userIds);

  for (const p of profiles ?? []) {
    byId.set(p.id, {
      full_name: p.full_name ?? "",
      company_name: p.company_name ?? "",
      email: "",
    });
  }

  return rows.map((r) => ({
    ...r,
    recipient: byId.get(r.user_id) ?? null,
  }));
}

async function loadRecipientEmail(userId: string): Promise<string> {
  try {
    const hits = await searchPlatformUsers(userId, 5);
    return hits.find((h) => h.user_id === userId)?.email ?? "";
  } catch {
    return "";
  }
}

export function CrmRewardPanel() {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<ClienteProfileHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<ClienteProfileHit | null>(null);
  const [rewardAll, setRewardAll] = useState(false);
  const [rewardKind, setRewardKind] = useState<CrmRewardKind>("credits");
  const [amount, setAmount] = useState("1");
  const [expiresDate, setExpiresDate] = useState(defaultExpiresDate);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [recent, setRecent] = useState<CrmRewardListItem[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [detail, setDetail] = useState<CrmRewardListItem | null>(null);
  const [detailLoadingEmail, setDetailLoadingEmail] = useState(false);

  const dateLocale = i18n.language?.startsWith("es") ? "es-ES" : "en-GB";

  const openDetail = async (r: CrmRewardListItem) => {
    setDetail(r);
    if (r.recipient?.email) return;
    setDetailLoadingEmail(true);
    try {
      const email = await loadRecipientEmail(r.user_id);
      if (!email) return;
      const enriched = {
        ...r,
        recipient: {
          full_name: r.recipient?.full_name ?? "",
          company_name: r.recipient?.company_name ?? "",
          email,
        },
      } as CrmRewardListItem;
      setDetail(enriched);
      setRecent((prev) => prev.map((row) => (row.id === r.id && row.kind === r.kind ? enriched : row)));
    } finally {
      setDetailLoadingEmail(false);
    }
  };

  const loadRecent = useCallback(async () => {
    setLoadingRecent(true);
    try {
      const [creditsRes, featureRes] = await Promise.all([
        supabase
          .from("credit_rewards")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("feature_access_rewards")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(30),
      ]);

      if (creditsRes.error) throw creditsRes.error;
      // Table may not exist until migration is applied
      if (featureRes.error && !/feature_access_rewards|schema cache|does not exist/i.test(featureRes.error.message)) {
        throw featureRes.error;
      }

      const creditItems: CrmRewardListItem[] = ((creditsRes.data as CreditReward[]) ?? []).map((r) => ({
        ...r,
        kind: "credits" as const,
      }));
      const featureItems: CrmRewardListItem[] = ((featureRes.data as FeatureAccessReward[]) ?? []).map((r) => ({
        ...r,
        kind: r.module === "partners" ? "partners" as const : "resoluciones" as const,
      }));

      const merged = [...creditItems, ...featureItems]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 30);

      setRecent(await enrichWithRecipients(merged));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.crm.rewardLoadError"));
    } finally {
      setLoadingRecent(false);
    }
  }, [t]);

  useEffect(() => { void loadRecent(); }, [loadRecent]);

  const runSearch = async () => {
    setSearching(true);
    setSearched(true);
    try {
      const hits = await searchPlatformUsers(query);
      setSuggestions(hits);
      if (hits.length === 0) {
        toast.message(t("admin.crm.rewardNoResults"));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.crm.rewardSearchError"));
      setSuggestions([]);
    } finally {
      setSearching(false);
    }
  };

  const sendReward = async () => {
    if (!rewardAll && !selected) {
      toast.error(t("admin.crm.rewardSelectUser"));
      return;
    }
    if (!message.trim()) {
      toast.error(t("admin.crm.rewardMessageRequired"));
      return;
    }

    setSending(true);
    try {
      if (rewardKind === "credits") {
        const credits = parseInt(amount, 10);
        if (!Number.isFinite(credits) || credits <= 0) {
          toast.error(t("admin.crm.rewardInvalidAmount"));
          return;
        }
        const { data, error } = await supabase.rpc("create_credit_rewards", {
          p_user_ids: rewardAll ? [] : [selected!.user_id],
          p_amount: credits,
          p_message: message.trim(),
        });
        if (error) throw error;
        toast.success(t("admin.crm.rewardSent", { count: data ?? 0 }));
      } else {
        const expiresIso = endOfLocalDayIso(expiresDate);
        if (!expiresIso || new Date(expiresIso).getTime() <= Date.now()) {
          toast.error(t("admin.crm.rewardInvalidExpires"));
          return;
        }
        const { data, error } = await supabase.rpc("create_feature_access_rewards", {
          p_user_ids: rewardAll ? [] : [selected!.user_id],
          p_module: rewardKind,
          p_expires_at: expiresIso,
          p_message: message.trim(),
        });
        if (error) throw error;
        toast.success(t("admin.crm.rewardSent", { count: data ?? 0 }));
      }

      setMessage("");
      setAmount("1");
      setExpiresDate(defaultExpiresDate());
      setSelected(null);
      setRewardAll(false);
      setSuggestions([]);
      setQuery("");
      setSearched(false);
      await loadRecent();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.crm.rewardSendError"));
    } finally {
      setSending(false);
    }
  };

  const rewardSummary = (r: CrmRewardListItem): string => {
    if (r.kind === "credits") {
      return `${r.amount} ${t("admin.crm.rewardCreditsUnit")}`;
    }
    const key = r.kind === "partners"
      ? "admin.crm.rewardPartnersUntil"
      : "admin.crm.rewardResolucionesUntil";
    return t(key, {
      date: new Date(r.expires_at).toLocaleDateString(dateLocale),
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-amber-500" />
            {t("admin.crm.rewardTitle")}
          </CardTitle>
          <CardDescription>{t("admin.crm.rewardDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="reward-all"
              checked={rewardAll}
              onCheckedChange={(v) => {
                setRewardAll(v === true);
                if (v === true) {
                  setSelected(null);
                  setSuggestions([]);
                  setSearched(false);
                }
              }}
            />
            <Label htmlFor="reward-all">{t("admin.crm.rewardAll")}</Label>
          </div>

          {!rewardAll && (
            <div className="space-y-2">
              <Label>{t("admin.crm.rewardUser")}</Label>
              {selected ? (
                <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div>
                    <p className="font-medium text-sm">{selected.full_name || selected.email || selected.user_id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">
                      {[selected.email, selected.company_name].filter(Boolean).join(" · ")
                        || selected.user_id}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setSelected(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <div className="flex gap-2">
                    <Input
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setSearched(false);
                      }}
                      placeholder={t("admin.crm.rewardSearchPlaceholder")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void runSearch();
                        }
                      }}
                    />
                    <Button type="button" variant="outline" onClick={() => void runSearch()} disabled={searching}>
                      {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </Button>
                  </div>
                  {suggestions.length > 0 && (
                    <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-md max-h-56 overflow-auto">
                      {suggestions.map((hit) => (
                        <button
                          key={hit.user_id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                          onClick={() => {
                            setSelected(hit);
                            setSuggestions([]);
                            setQuery("");
                            setSearched(false);
                          }}
                        >
                          <span className="font-medium">
                            {hit.full_name || hit.email || hit.user_id.slice(0, 8)}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {[hit.email, hit.company_name].filter(Boolean).join(" · ") || hit.user_id}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {searched && !searching && suggestions.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {t("admin.crm.rewardNoResultsHint")}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>{t("admin.crm.rewardType")}</Label>
              <Select
                value={rewardKind}
                onValueChange={(v) => setRewardKind(v as CrmRewardKind)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credits">{t("admin.crm.rewardTypeCredits")}</SelectItem>
                  <SelectItem value="resoluciones">{t("admin.crm.rewardTypeResoluciones")}</SelectItem>
                  <SelectItem value="partners">{t("admin.crm.rewardTypePartners")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {rewardKind === "credits" ? (
              <div>
                <Label>{t("admin.crm.rewardCredits")}</Label>
                <Input
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            ) : (
              <div>
                <Label>{t("admin.crm.rewardExpiresAt")}</Label>
                <Input
                  type="date"
                  value={expiresDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setExpiresDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t("admin.crm.rewardExpiresHint")}
                </p>
              </div>
            )}

            <div className="sm:col-span-2">
              <Label>{t("admin.crm.rewardMessage")}</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder={t("admin.crm.rewardMessagePlaceholder")}
              />
            </div>
          </div>

          <Button onClick={() => void sendReward()} disabled={sending} className="gap-2">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
            {t("admin.crm.rewardSend")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.crm.rewardRecent")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingRecent ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("admin.crm.rewardNoRecent")}</p>
          ) : (
            <div className="space-y-2">
              {recent.map((r) => (
                <div key={`${r.kind}-${r.id}`} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {rewardSummary(r)}
                      <span className="font-normal text-muted-foreground">
                        {" · "}
                        {recipientLabel(r, t("admin.crm.rewardDetailUnknownUser"))}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground truncate max-w-[320px]">{r.message}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-muted-foreground">
                      {r.kind === "credits"
                        ? t("admin.crm.rewardTypeCredits")
                        : r.kind === "partners"
                          ? t("admin.crm.rewardTypePartners")
                          : t("admin.crm.rewardTypeResoluciones")}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        r.status === "pending" && "border-amber-500/40 text-amber-600",
                        r.status === "accepted" && "border-emerald-500/40 text-emerald-600",
                      )}
                    >
                      {t(`admin.crm.rewardStatus.${r.status}`)}
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => void openDetail(r)}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {t("admin.crm.rewardView")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={(open) => { if (!open) setDetail(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("admin.crm.rewardDetailTitle")}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {t("admin.crm.rewardDetailRecipient")}
                </p>
                <p className="font-medium mt-1">
                  {recipientLabel(detail, t("admin.crm.rewardDetailUnknownUser"))}
                </p>
                <p className="text-muted-foreground text-xs mt-0.5 flex items-center gap-1.5">
                  {detailLoadingEmail && !detail.recipient?.email ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : null}
                  {recipientSub(detail)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {t("admin.crm.rewardDetailMessage")}
                </p>
                <p className="mt-1 whitespace-pre-wrap rounded-md border bg-muted/40 px-3 py-2">
                  {detail.message || "—"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {t("admin.crm.rewardType")}
                  </p>
                  <p className="mt-1 font-medium">
                    {detail.kind === "credits"
                      ? t("admin.crm.rewardTypeCredits")
                      : detail.kind === "partners"
                        ? t("admin.crm.rewardTypePartners")
                        : t("admin.crm.rewardTypeResoluciones")}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {detail.kind === "credits"
                      ? t("admin.crm.rewardDetailAmount")
                      : t("admin.crm.rewardExpiresAt")}
                  </p>
                  <p className="mt-1 font-medium">
                    {detail.kind === "credits"
                      ? `${detail.amount} ${t("admin.crm.rewardCreditsUnit")}`
                      : new Date(detail.expires_at).toLocaleString(dateLocale)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {t("admin.crm.rewardDetailStatus")}
                  </p>
                  <p className="mt-1">
                    <Badge
                      variant="outline"
                      className={cn(
                        detail.status === "pending" && "border-amber-500/40 text-amber-600",
                        detail.status === "accepted" && "border-emerald-500/40 text-emerald-600",
                      )}
                    >
                      {t(`admin.crm.rewardStatus.${detail.status}`)}
                    </Badge>
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {t("admin.crm.rewardDetailDate")}
                  </p>
                  <p className="mt-1">
                    {new Date(detail.created_at).toLocaleString(dateLocale)}
                  </p>
                </div>
                {detail.accepted_at && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {t("admin.crm.rewardDetailAccepted")}
                    </p>
                    <p className="mt-1">
                      {new Date(detail.accepted_at).toLocaleString(dateLocale)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDetail(null)}>
              {t("admin.crm.rewardDetailClose")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
