"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { useT } from "@/i18n/provider";
import { LOCALES } from "@/i18n/locales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DEMO_CANDIDATES } from "@/lib/demo-data";
import { filterByAndLogic } from "@/lib/and-filter";
import { canUseNaturalLanguage, canUsePatents } from "@/lib/rbac";
import { useAuth } from "@/components/auth-provider";
import {
  criteriaForRecipient,
  defaultSection,
  deleteBulletin,
  normalizeBulletin,
  saveBulletin,
  type BulletinMode,
  type BulletinRecipient,
  type StoredBulletin,
} from "@/lib/bulletins-store";
import { toast } from "sonner";
import { withLocale } from "@/lib/paths";
import { useLocale } from "@/i18n/provider";

function csv(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function CsvField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  className?: string;
}) {
  const [text, setText] = useState(value.join(", "));
  const serialized = value.join("\u0001");

  useEffect(() => {
    setText(serialized.split("\u0001").filter(Boolean).join(", "));
  }, [serialized]);

  return (
    <Input
      className={className}
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        setText(e.target.value);
        onChange(csv(e.target.value));
      }}
    />
  );
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const WEEKDAYS = ["1", "2", "3", "4", "5", "6", "7"];

export function BulletinEditor({ initial }: { initial: StoredBulletin }) {
  const t = useT();
  const { locale } = useLocale();
  const router = useRouter();
  const { user } = useAuth();
  const [draft, setDraft] = useState<StoredBulletin>(() => normalizeBulletin(initial));
  const [recipientDraft, setRecipientDraft] = useState("");
  const [previewEmail, setPreviewEmail] = useState(() => normalizeBulletin(initial).recipients[0]?.email ?? "");

  const allowNl = canUseNaturalLanguage(user?.plan);
  const allowPatents = canUsePatents(user?.plan);
  const nlOk = (draft.nlQuery ?? "").trim().split(/\s+/).filter(Boolean).length >= 15;
  const isNew = !initial.name;

  const preview = useMemo(() => {
    const criteria = criteriaForRecipient(draft, draft.mode === "advanced" ? previewEmail : undefined);
    const included = filterByAndLogic(DEMO_CANDIDATES, criteria);
    const rejected = DEMO_CANDIDATES.filter((c) => !included.some((i) => i.id === c.id));
    return { included, rejected };
  }, [draft, previewEmail]);

  function patch(next: Partial<StoredBulletin>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function addRecipient(emailRaw = recipientDraft) {
    const email = emailRaw.trim().toLowerCase();
    if (!isEmail(email)) {
      if (emailRaw.trim()) toast.error(t("contact.validation"));
      return;
    }
    if (draft.recipients.some((row) => row.email === email)) return;
    const next: BulletinRecipient = { email, companies: [], technologies: [] };
    patch({ recipients: [...draft.recipients, next] });
    setRecipientDraft("");
    if (!previewEmail) setPreviewEmail(email);
  }

  function updateRecipient(email: string, patchRow: Partial<BulletinRecipient>) {
    patch({
      recipients: draft.recipients.map((row) => (row.email === email ? { ...row, ...patchRow } : row)),
    });
  }

  function removeRecipient(email: string) {
    const recipients = draft.recipients.filter((row) => row.email !== email);
    patch({ recipients });
    if (previewEmail === email) setPreviewEmail(recipients[0]?.email ?? "");
  }

  function setMode(mode: BulletinMode) {
    patch({ mode });
    if (mode === "advanced" && !previewEmail) setPreviewEmail(draft.recipients[0]?.email ?? "");
  }

  async function parseNl() {
    if (!nlOk) {
      toast.error(t("bulletin.nlTooShort"));
      return;
    }
    const res = await fetch("/api/nl-query", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: draft.nlQuery }),
    });
    const data = (await res.json()) as { companies?: string[]; technologies?: string[] };
    const first = draft.sections[0] ?? defaultSection();
    patch({
      sections: [
        {
          ...first,
          companies: data.companies?.length ? data.companies : first.companies,
          technologies: data.technologies?.length ? data.technologies : first.technologies,
        },
        ...draft.sections.slice(1),
      ],
    });
  }

  function onSave() {
    if (!draft.name.trim() || !draft.subject.trim()) {
      toast.error(t("contact.validation"));
      return;
    }
    if (!draft.recipients.length) {
      toast.error(t("bulletin.needRecipients"));
      return;
    }
    saveBulletin({ ...draft, status: draft.status === "draft" ? "active" : draft.status });
    toast.success(t("bulletin.saved"));
    router.push(withLocale(locale, "/dashboard/boletines"));
  }

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
          <div>
            <Label htmlFor="bulletin-send-day">{t("bulletin.sendDay")}</Label>
            <select
              id="bulletin-send-day"
              className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              value={String(draft.sendDay ?? 1)}
              onChange={(e) => patch({ sendDay: Number(e.target.value) })}
            >
              {WEEKDAYS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div>
          <Label htmlFor="bulletin-send-hour">{t("bulletin.sendHour")}</Label>
          <Input
            id="bulletin-send-hour"
            type="number"
            min={0}
            max={23}
            value={draft.sendHour}
            onChange={(e) => patch({ sendHour: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="bulletin-timezone">{t("bulletin.timezone")}</Label>
          <Input id="bulletin-timezone" value={draft.timezone} onChange={(e) => patch({ timezone: e.target.value })} />
        </div>
      </div>

      <section className="space-y-4 rounded-xl border bg-card p-4">
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
          {draft.mode === "common" ? (
            <>
              <div className="mt-2 flex flex-wrap gap-2">
                {draft.recipients.map((row) => (
                  <Badge key={row.email} variant="secondary" className="gap-1">
                    {row.email}
                    <button type="button" aria-label={t("bulletin.removeRecipient")} onClick={() => removeRecipient(row.email)}>
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <Input
                  type="email"
                  value={recipientDraft}
                  onChange={(e) => setRecipientDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addRecipient();
                    }
                  }}
                  placeholder="nina.v@example.com"
                />
                <Button type="button" variant="outline" onClick={() => addRecipient()}>
                  {t("bulletin.addRecipient")}
                </Button>
              </div>
            </>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">{t("bulletin.advancedTableHint")}</p>
          )}
        </div>

        {allowNl ? (
          <div className="rounded-lg border p-3">
            <Label htmlFor="bulletin-nl">{t("bulletin.nlQuery")}</Label>
            <p className="mb-2 text-xs text-muted-foreground">
              {t("bulletin.nlOption")} · {t("bulletin.nlHint")}
            </p>
            <Textarea id="bulletin-nl" rows={4} value={draft.nlQuery} onChange={(e) => patch({ nlQuery: e.target.value })} />
            <Button type="button" className="mt-3" variant="outline" onClick={() => void parseNl()}>
              {t("bulletin.parseNl")}
            </Button>
          </div>
        ) : null}

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-medium">{t("bulletin.matrix")}</h3>
              <p className="text-xs text-muted-foreground">
                {draft.mode === "advanced" ? t("bulletin.defaultsForEmpty") : t("bulletin.commonFilterLead")}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => patch({ sections: [...draft.sections, defaultSection(draft.sections.length + 1)] })}
            >
              <Plus className="size-3.5" /> {t("bulletin.addSection")}
            </Button>
          </div>
          <div className="space-y-4">
            {draft.sections.map((section, idx) => (
              <div key={idx} className="rounded-lg border p-4">
                <Input
                  className="mb-3"
                  value={section.title}
                  onChange={(e) => {
                    const sections = [...draft.sections];
                    sections[idx] = { ...section, title: e.target.value };
                    patch({ sections });
                  }}
                />
                <Label>{t("bulletin.companies")}</Label>
                <CsvField
                  className="mb-2"
                  value={section.companies}
                  onChange={(companies) => {
                    const sections = [...draft.sections];
                    sections[idx] = { ...section, companies };
                    patch({ sections });
                  }}
                  placeholder="Bosch, Continental"
                />
                <Label>{t("bulletin.technologies")}</Label>
                <CsvField
                  value={section.technologies}
                  onChange={(technologies) => {
                    const sections = [...draft.sections];
                    sections[idx] = { ...section, technologies };
                    patch({ sections });
                  }}
                  placeholder="printed electronics, OLED"
                />
              </div>
            ))}
          </div>
        </div>

        {draft.mode === "advanced" ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-medium">{t("bulletin.advancedTable")}</h3>
              <div className="flex gap-2">
                <Input
                  type="email"
                  className="w-56"
                  value={recipientDraft}
                  onChange={(e) => setRecipientDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addRecipient();
                    }
                  }}
                  placeholder="nina.v@example.com"
                />
                <Button type="button" variant="outline" size="sm" onClick={() => addRecipient()}>
                  {t("bulletin.addRecipient")}
                </Button>
              </div>
            </div>
            {draft.recipients.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{t("bulletin.noRecipientsAdvanced")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("bulletin.recipientEmail")}</TableHead>
                    <TableHead>{t("bulletin.companies")}</TableHead>
                    <TableHead>{t("bulletin.technologies")}</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {draft.recipients.map((row) => (
                    <TableRow key={row.email}>
                      <TableCell className="align-top font-medium">{row.email}</TableCell>
                      <TableCell>
                        <CsvField
                          value={row.companies}
                          onChange={(companies) => updateRecipient(row.email, { companies })}
                          placeholder={t("bulletin.inheritDefaults")}
                        />
                      </TableCell>
                      <TableCell>
                        <CsvField
                          value={row.technologies}
                          onChange={(technologies) => updateRecipient(row.email, { technologies })}
                          placeholder={t("bulletin.inheritDefaults")}
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <Button type="button" variant="ghost" size="icon" aria-label={t("bulletin.removeRecipient")} onClick={() => removeRecipient(row.email)}>
                          <X className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
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
        <Button type="button" onClick={onSave}>
          {t("common.save")}
        </Button>
        {!isNew ? (
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              if (!window.confirm(t("bulletin.delete"))) return;
              deleteBulletin(draft.id);
              toast.success(t("bulletin.deleted"));
              router.push(withLocale(locale, "/dashboard/boletines"));
            }}
          >
            {t("bulletin.delete")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
