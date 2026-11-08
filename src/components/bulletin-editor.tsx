"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useT } from "@/i18n/provider";
import { LOCALES } from "@/i18n/locales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DEMO_CANDIDATES } from "@/lib/demo-data";
import { filterByAndLogic, type CandidateItem } from "@/lib/and-filter";
import { canUseNaturalLanguage, canUsePatents, maxActiveBulletins } from "@/lib/rbac";
import { useAuth } from "@/components/auth-provider";
import { demoApiHeaders } from "@/lib/api/demo-headers";
import {
  bulletinPool,
  criteriaForRecipient,
  defaultSection,
  normalizeBulletin,
  type BulletinMode,
  type BulletinRecipient,
  type StoredBulletin,
} from "@/lib/bulletins-store";
import { BulletinCapError, countActiveBulletins, deleteBulletin, saveBulletin } from "@/lib/bulletins-repository";
import { recordBulletinDelivery } from "@/lib/bulletin-deliveries-store";
import { recordActivity } from "@/lib/activity";
import { toast } from "sonner";
import { withLocale } from "@/lib/paths";
import { useLocale } from "@/i18n/provider";
import { appendClientAiUsage } from "@/lib/ai/usage-store";

function uniqueLabels(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function ChipList({
  values,
  onChange,
  placeholder,
  hint,
  validate,
  removeLabel,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  hint?: string;
  validate?: (raw: string) => string | null;
  removeLabel?: string;
}) {
  const [text, setText] = useState("");

  function commit(raw: string) {
    const parts = raw
      .split(/[,;\n]+/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const next = [...values];
    for (const part of parts) {
      const normalized = validate ? validate(part) : part.trim();
      if (!normalized) continue;
      if (!next.some((item) => item.toLowerCase() === normalized.toLowerCase())) next.push(normalized);
    }
    onChange(next);
    setText("");
  }

  return (
    <div>
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1.5 focus-within:ring-1 focus-within:ring-ring">
        {values.map((value) => (
          <span
            key={value}
            className="inline-flex items-center gap-1 rounded-md border bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground"
          >
            {value}
            <button
              type="button"
              className="rounded-sm opacity-70 hover:opacity-100"
              aria-label={removeLabel ? `${removeLabel} ${value}` : value}
              onClick={() => onChange(values.filter((item) => item !== value))}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          className="min-w-[10rem] flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
          value={text}
          placeholder={values.length ? "" : placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit(text);
            }
            if (e.key === "Backspace" && !text && values.length) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={() => {
            if (text.trim()) commit(text);
          }}
        />
      </div>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  min,
  max,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (!Number.isFinite(next)) return;
          onChange(Math.min(max, Math.max(min, Math.round(next))));
        }}
      />
    </div>
  );
}

export function BulletinEditor({ initial }: { initial: StoredBulletin }) {
  const t = useT();
  const { locale } = useLocale();
  const router = useRouter();
  const { user } = useAuth();
  const [draft, setDraft] = useState<StoredBulletin>(() => normalizeBulletin(initial));
  const [previewEmail, setPreviewEmail] = useState(() => normalizeBulletin(initial).recipients[0]?.email ?? "");
  const [sending, setSending] = useState(false);
  const [newsCandidates, setNewsCandidates] = useState<CandidateItem[]>([]);
  const [newsSearching, setNewsSearching] = useState(false);

  const allowNl = canUseNaturalLanguage(user?.plan);
  const allowPatents = canUsePatents(user?.plan);
  const nlOk = (draft.nlQuery ?? "").trim().split(/\s+/).filter(Boolean).length >= 15;
  const isNew = !initial.name;
  const pool = useMemo(() => bulletinPool(draft), [draft]);

  const candidatePool = useMemo(() => {
    const byId = new Map<string, CandidateItem>();
    for (const c of DEMO_CANDIDATES) byId.set(c.id, c);
    for (const c of newsCandidates) byId.set(c.id, c);
    return [...byId.values()];
  }, [newsCandidates]);

  const preview = useMemo(() => {
    const criteria = criteriaForRecipient(draft, draft.mode === "advanced" ? previewEmail : undefined);
    const included = filterByAndLogic(candidatePool, criteria);
    const rejected = candidatePool.filter((c) => !included.some((i) => i.id === c.id));
    return { included, rejected };
  }, [draft, previewEmail, candidatePool]);

  async function searchNews() {
    const q = [
      ...pool.companies.slice(0, 3),
      ...pool.technologies.slice(0, 3),
      draft.nlQuery?.trim() ?? "",
    ]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (!q) {
      toast.message(t("bulletin.newsSearchNeedQuery"));
      return;
    }
    setNewsSearching(true);
    try {
      const res = await fetch("/api/news/search", {
        method: "POST",
        headers: { "content-type": "application/json", ...demoApiHeaders(user) },
        body: JSON.stringify({ query: q, limit: 8, language: draft.language }),
      });
      const data = (await res.json()) as {
        items?: Array<{ title?: string; url?: string; source?: string; snippet?: string; publishedAt?: string }>;
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? t("bulletin.newsSearchError"));
        return;
      }
      const mapped: CandidateItem[] = (data.items ?? []).map((item, i) => ({
        id: `news-${Date.now()}-${i}`,
        title: item.title ?? "Untitled",
        body: item.snippet ?? item.title ?? "",
        url: item.url ?? "#",
        source: "news" as const,
        publishedAt: item.publishedAt ?? new Date().toISOString(),
        company: pool.companies[0],
      }));
      setNewsCandidates(mapped);
      toast.success(t("bulletin.newsSearchDone").replace("{n}", String(mapped.length)));
    } finally {
      setNewsSearching(false);
    }
  }

  function patch(next: Partial<StoredBulletin>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function setPool(next: { companies?: string[]; technologies?: string[] }) {
    setDraft((current) => {
      const currentPool = bulletinPool(current);
      const companies = uniqueLabels(next.companies ?? currentPool.companies);
      const technologies = uniqueLabels(next.technologies ?? currentPool.technologies);
      const first = current.sections[0] ?? defaultSection();
      const addedCompanies = companies.filter((item) => !currentPool.companies.includes(item));
      const removedCompanies = currentPool.companies.filter((item) => !companies.includes(item));
      const addedTechnologies = technologies.filter((item) => !currentPool.technologies.includes(item));
      const removedTechnologies = currentPool.technologies.filter((item) => !technologies.includes(item));
      const recipients =
        current.mode === "advanced"
          ? current.recipients.map((row) => ({
              ...row,
              companies: uniqueLabels([...row.companies.filter((item) => !removedCompanies.includes(item)), ...addedCompanies]),
              technologies: uniqueLabels([
                ...row.technologies.filter((item) => !removedTechnologies.includes(item)),
                ...addedTechnologies,
              ]),
            }))
          : current.recipients;
      return { ...current, sections: [{ ...first, companies, technologies }], recipients };
    });
  }

  function setRecipientEmails(emails: string[]) {
    const uniqueEmails = uniqueLabels(emails.map((email) => email.toLowerCase())).filter(isEmail);
    setDraft((current) => {
      const currentPool = bulletinPool(current);
      const byEmail = new Map(current.recipients.map((row) => [row.email, row]));
      const recipients = uniqueEmails.map((email) => {
        const existing = byEmail.get(email);
        if (existing) return existing;
        return current.mode === "advanced"
          ? { email, companies: [...currentPool.companies], technologies: [...currentPool.technologies] }
          : { email, companies: [], technologies: [] };
      });
      return { ...current, recipients };
    });
    if (previewEmail && !uniqueEmails.includes(previewEmail)) setPreviewEmail(uniqueEmails[0] ?? "");
    if (!previewEmail && uniqueEmails[0]) setPreviewEmail(uniqueEmails[0]);
  }

  function updateRecipient(email: string, patchRow: Partial<BulletinRecipient>) {
    patch({
      recipients: draft.recipients.map((row) => (row.email === email ? { ...row, ...patchRow } : row)),
    });
  }

  function toggleRecipientItem(email: string, kind: "companies" | "technologies", value: string) {
    const row = draft.recipients.find((item) => item.email === email);
    if (!row) return;
    const current = row[kind];
    const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
    updateRecipient(email, { [kind]: next });
  }

  function setRecipientAll(email: string, selected: boolean) {
    updateRecipient(email, {
      companies: selected ? [...pool.companies] : [],
      technologies: selected ? [...pool.technologies] : [],
    });
  }

  function removeRecipient(email: string) {
    const recipients = draft.recipients.filter((row) => row.email !== email);
    patch({ recipients });
    if (previewEmail === email) setPreviewEmail(recipients[0]?.email ?? "");
  }

  function setMode(mode: BulletinMode) {
    if (mode === "advanced") {
      patch({
        mode,
        recipients: draft.recipients.map((row) => ({
          ...row,
          companies: row.companies.length ? row.companies.filter((item) => pool.companies.includes(item)) : [...pool.companies],
          technologies: row.technologies.length
            ? row.technologies.filter((item) => pool.technologies.includes(item))
            : [...pool.technologies],
        })),
      });
      if (!previewEmail) setPreviewEmail(draft.recipients[0]?.email ?? "");
      return;
    }
    patch({
      mode,
      recipients: draft.recipients.map((row) => ({ ...row, companies: [], technologies: [] })),
    });
  }

  async function parseNl() {
    if (!nlOk) {
      toast.error(t("bulletin.nlTooShort"));
      return;
    }
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...demoApiHeaders(user),
    };
    const res = await fetch("/api/nl-query", {
      method: "POST",
      headers,
      body: JSON.stringify({ query: draft.nlQuery }),
    });
    const data = (await res.json()) as { companies?: string[]; technologies?: string[]; error?: string };
    if (!res.ok) {
      if (data.error === "plan_required") {
        toast.error(t("bulletin.planRequired"), {
          action: {
            label: t("billing.upgrade"),
            onClick: () => {
              window.location.href = withLocale(locale, "/dashboard/facturacion");
            },
          },
        });
      } else {
        toast.error(t("contact.validation"));
      }
      return;
    }
    if (user) {
      appendClientAiUsage({
        userId: user.id,
        kind: "nl_query",
        meta: {
          companies: data.companies?.length ?? 0,
          technologies: data.technologies?.length ?? 0,
        },
      });
    }
    setPool({
      companies: data.companies?.length ? uniqueLabels([...pool.companies, ...data.companies]) : pool.companies,
      technologies: data.technologies?.length ? uniqueLabels([...pool.technologies, ...data.technologies]) : pool.technologies,
    });
  }

  async function ensureActiveCap(nextStatus: StoredBulletin["status"]): Promise<boolean> {
    if (nextStatus !== "active" || !user) return true;
    const cap = maxActiveBulletins(user.plan);
    if (cap == null) return true;
    const active = await countActiveBulletins(user.id);
    const alreadyActive = draft.status === "active";
    if (!alreadyActive && active >= cap) {
      toast.error(t("bulletin.activeCap"));
      return false;
    }
    return true;
  }

  async function onSave() {
    if (!draft.name.trim() || !draft.subject.trim()) {
      toast.error(t("contact.validation"));
      return;
    }
    if (!draft.recipients.length) {
      toast.error(t("bulletin.needRecipients"));
      return;
    }
    const nextStatus = draft.status === "draft" ? "active" : draft.status;
    if (!(await ensureActiveCap(nextStatus))) return;
    try {
      await saveBulletin({ ...draft, status: nextStatus }, { plan: user?.plan });
    } catch (err) {
      if (err instanceof BulletinCapError) {
        toast.error(t("bulletin.activeCap"));
        return;
      }
      throw err;
    }
    toast.success(t("bulletin.saved"));
    router.push(withLocale(locale, "/dashboard/boletines"));
  }

  async function onSendNow() {
    if (!draft.name.trim() || !draft.subject.trim()) {
      toast.error(t("contact.validation"));
      return;
    }
    if (!draft.recipients.length) {
      toast.error(t("bulletin.needRecipients"));
      return;
    }
    const nextStatus = draft.status === "draft" ? "active" : draft.status;
    if (!(await ensureActiveCap(nextStatus))) return;
    let saved: StoredBulletin;
    try {
      saved = await saveBulletin({ ...draft, status: nextStatus }, { plan: user?.plan });
    } catch (err) {
      if (err instanceof BulletinCapError) {
        toast.error(t("bulletin.activeCap"));
        return;
      }
      throw err;
    }
    setDraft(saved);
    setSending(true);
    try {
      const headers: Record<string, string> = {
        "content-type": "application/json",
        ...demoApiHeaders(user),
      };
      const res = await fetch("/api/bulletins/send", {
        method: "POST",
        headers,
        body: JSON.stringify({
          bulletinId: saved.id,
          bulletin: saved,
          orgName: user?.organizationName ?? "",
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        demo?: boolean;
        error?: string;
        delivery?: {
          bulletinId: string;
          bulletinName: string;
          org: string;
          recipients: string[];
          itemCount: number;
          when: string;
          status: "sent" | "demo";
          demo: boolean;
        };
      };
      if (!res.ok || !data.ok) {
        if (user) {
          void recordActivity({
            organizationId: user.organizationId,
            userId: user.id,
            kind: "delivery_failed",
            title: `Fallo de envío: ${draft.name}`,
            meta: { bulletinId: draft.id, error: data.error },
          });
          const { pushNotification } = await import("@/lib/notifications-store");
          pushNotification({
            organizationId: user.organizationId,
            userId: user.id,
            kind: "delivery_failed",
            title: `Envío fallido tras reintentos`,
            body: data.error ?? t("bulletin.sendError"),
          });
        }
        toast.error(data.error ?? t("bulletin.sendError"));
        return;
      }
      if (data.delivery) {
        recordBulletinDelivery(data.delivery);
      }
      if (user) {
        void recordActivity({
          organizationId: user.organizationId,
          userId: user.id,
          kind: "bulletin_sent",
          title: `Boletín enviado: ${draft.name}`,
          meta: { bulletinId: draft.id, demo: Boolean(data.demo) },
        });
      }
      toast.success(data.demo ? t("bulletin.sentDemo") : t("bulletin.sent"));
    } catch {
      toast.error(t("bulletin.sendError"));
    } finally {
      setSending(false);
    }
  }

  const matrixReady = pool.companies.length + pool.technologies.length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {isNew ? t("dashboard.newBulletin") : draft.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("bulletin.andHint")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="bulletin-name">{t("bulletin.name")}</Label>
          <Input id="bulletin-name" value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="bulletin-subject">{t("bulletin.subject")}</Label>
          <Input id="bulletin-subject" value={draft.subject} onChange={(e) => patch({ subject: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="bulletin-language">{t("bulletin.language")}</Label>
          <select
            id="bulletin-language"
            className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            value={draft.language}
            onChange={(e) => patch({ language: e.target.value })}
          >
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="bulletin-frequency">{t("bulletin.frequency")}</Label>
          <select
            id="bulletin-frequency"
            className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            value={draft.frequency}
            onChange={(e) => patch({ frequency: e.target.value as StoredBulletin["frequency"] })}
          >
            {(["daily", "weekly", "biweekly", "monthly"] as const).map((f) => (
              <option key={f} value={f}>
                {t(`bulletin.${f}`)}
              </option>
            ))}
          </select>
        </div>
        {draft.frequency === "weekly" ? (
          <NumberField
            id="bulletin-send-day"
            label={t("bulletin.sendDay")}
            value={draft.sendDay ?? 1}
            min={1}
            max={7}
            onChange={(sendDay) => patch({ sendDay })}
          />
        ) : null}
        <NumberField
          id="bulletin-send-hour"
          label={t("bulletin.sendHour")}
          value={draft.sendHour}
          min={0}
          max={23}
          onChange={(sendHour) => patch({ sendHour })}
        />
        <NumberField
          id="bulletin-max-items"
          label={t("bulletin.maxItems")}
          value={draft.maxItems}
          min={1}
          max={50}
          onChange={(maxItems) => patch({ maxItems })}
        />
        <div>
          <Label htmlFor="bulletin-timezone">{t("bulletin.timezone")}</Label>
          <Input id="bulletin-timezone" value={draft.timezone} onChange={(e) => patch({ timezone: e.target.value })} />
        </div>
      </div>

      <section className="space-y-5 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">{t("bulletin.configMode")}</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {draft.mode === "advanced" ? t("bulletin.advancedHint") : t("bulletin.commonHint")}
            </p>
          </div>
          <Tabs value={draft.mode} onValueChange={(value) => setMode(value as BulletinMode)}>
            <TabsList>
              <TabsTrigger value="common">{t("bulletin.modeCommon")}</TabsTrigger>
              <TabsTrigger value="advanced">{t("bulletin.modeAdvanced")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div>
          <Label>{t("bulletin.recipients")}</Label>
          <ChipList
            values={draft.recipients.map((row) => row.email)}
            onChange={setRecipientEmails}
            placeholder="nina.v@example.com"
            hint={t("bulletin.chipHint")}
            removeLabel={t("bulletin.removeRecipient")}
            validate={(raw) => {
              const email = raw.trim().toLowerCase();
              if (!isEmail(email)) {
                toast.error(t("contact.validation"));
                return null;
              }
              return email;
            }}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>{t("bulletin.companies")}</Label>
            <ChipList
              values={pool.companies}
              onChange={(companies) => setPool({ companies })}
              placeholder="Tesla"
              hint={t("bulletin.chipHint")}
              removeLabel={t("common.delete")}
            />
          </div>
          <div>
            <Label>{t("bulletin.keywords")}</Label>
            <ChipList
              values={pool.technologies}
              onChange={(technologies) => setPool({ technologies })}
              placeholder="OLED"
              hint={t("bulletin.chipHint")}
              removeLabel={t("common.delete")}
            />
          </div>
        </div>

        {allowNl ? (
          <div className="rounded-lg border p-3">
            <Label htmlFor="bulletin-nl">{t("bulletin.nlQuery")}</Label>
            <p className="mb-2 text-xs text-muted-foreground">
              {t("bulletin.nlOption")} · {t("bulletin.nlHint")}
            </p>
            <Textarea id="bulletin-nl" rows={3} value={draft.nlQuery} onChange={(e) => patch({ nlQuery: e.target.value })} />
            <Button type="button" className="mt-3" variant="outline" onClick={() => void parseNl()}>
              {t("bulletin.parseNl")}
            </Button>
          </div>
        ) : null}

        {draft.mode === "advanced" ? (
          <div className="space-y-3">
            <div>
              <h3 className="font-medium">{t("bulletin.advancedTable")}</h3>
              <p className="text-xs text-muted-foreground">{t("bulletin.advancedTableHint")}</p>
            </div>
            {draft.recipients.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{t("bulletin.noRecipientsAdvanced")}</p>
            ) : !matrixReady ? (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{t("bulletin.matrixEmptyPool")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-10 min-w-48 bg-card">{t("bulletin.recipientEmail")}</TableHead>
                    {pool.companies.length ? (
                      <TableHead colSpan={pool.companies.length} className="text-center">
                        {t("bulletin.companies")}
                      </TableHead>
                    ) : null}
                    {pool.technologies.length ? (
                      <TableHead colSpan={pool.technologies.length} className="text-center">
                        {t("bulletin.keywords")}
                      </TableHead>
                    ) : null}
                    <TableHead className="w-24" />
                  </TableRow>
                  <TableRow>
                    <TableHead className="sticky left-0 z-10 bg-card" />
                    {pool.companies.map((item) => (
                      <TableHead key={`c-${item}`} className="max-w-28 px-2 text-center font-normal">
                        <span className="line-clamp-2 text-xs">{item}</span>
                      </TableHead>
                    ))}
                    {pool.technologies.map((item) => (
                      <TableHead key={`k-${item}`} className="max-w-28 px-2 text-center font-normal">
                        <span className="line-clamp-2 text-xs">{item}</span>
                      </TableHead>
                    ))}
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {draft.recipients.map((row) => {
                    const selectedCount = row.companies.length + row.technologies.length;
                    const totalCount = pool.companies.length + pool.technologies.length;
                    return (
                      <TableRow key={row.email}>
                        <TableCell className="sticky left-0 z-10 bg-card font-medium">{row.email}</TableCell>
                        {pool.companies.map((item) => (
                          <TableCell key={`${row.email}-c-${item}`} className="text-center">
                            <Checkbox
                              checked={row.companies.includes(item)}
                              onCheckedChange={() => toggleRecipientItem(row.email, "companies", item)}
                              aria-label={`${row.email} ${item}`}
                            />
                          </TableCell>
                        ))}
                        {pool.technologies.map((item) => (
                          <TableCell key={`${row.email}-k-${item}`} className="text-center">
                            <Checkbox
                              checked={row.technologies.includes(item)}
                              onCheckedChange={() => toggleRecipientItem(row.email, "technologies", item)}
                              aria-label={`${row.email} ${item}`}
                            />
                          </TableCell>
                        ))}
                        <TableCell className="whitespace-nowrap">
                          <button
                            type="button"
                            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                            onClick={() => setRecipientAll(row.email, selectedCount < totalCount)}
                          >
                            {selectedCount < totalCount ? t("bulletin.selectAll") : t("bulletin.selectNone")}
                          </button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="ml-1"
                            aria-label={t("bulletin.removeRecipient")}
                            onClick={() => removeRecipient(row.email)}
                          >
                            <X className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        ) : null}
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-semibold">{t("bulletin.preview")}</h2>
            {!allowPatents ? <p className="mt-1 text-xs text-muted-foreground">{t("bulletin.starterHint")}</p> : null}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Button type="button" variant="outline" size="sm" disabled={newsSearching} onClick={() => void searchNews()}>
              {newsSearching ? t("common.loading") : t("bulletin.searchNews")}
            </Button>
            {draft.mode === "advanced" && draft.recipients.length > 0 ? (
              <div className="w-full max-w-xs">
                <Label htmlFor="preview-recipient">{t("bulletin.previewRecipient")}</Label>
                <select
                  id="preview-recipient"
                  className="mt-1 flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                  value={previewEmail}
                  onChange={(e) => setPreviewEmail(e.target.value)}
                >
                  {draft.recipients.map((row) => (
                    <option key={row.email} value={row.email}>
                      {row.email}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium">{t("bulletin.included")}</p>
            <ul className="space-y-2">
              {preview.included.length === 0 ? (
                <li className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">{t("bulletin.previewEmpty")}</li>
              ) : (
                preview.included.map((item) => (
                  <li key={item.id} className="rounded-lg border p-3 text-sm">
                    <Badge className="mb-1">{item.source}</Badge>
                    <p className="font-medium">{item.title}</p>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">{t("bulletin.rejected")}</p>
            <ul className="space-y-2">
              {preview.rejected.map((item) => (
                <li key={item.id} className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  {item.title}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void onSave()}>
          {t("common.save")}
        </Button>
        <Button type="button" variant="outline" disabled={sending} onClick={() => void onSendNow()}>
          {sending ? t("common.loading") : t("bulletin.sendNow")}
        </Button>
        {!isNew ? (
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              if (!window.confirm(t("bulletin.delete"))) return;
              void (async () => {
                await deleteBulletin(draft.id);
                toast.success(t("bulletin.deleted"));
                router.push(withLocale(locale, "/dashboard/boletines"));
              })();
            }}
          >
            {t("bulletin.delete")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
