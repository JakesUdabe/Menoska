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
import { DEMO_CANDIDATES } from "@/lib/demo-data";
import { filterByAndLogic } from "@/lib/and-filter";
import { canUseNaturalLanguage, canUsePatents } from "@/lib/rbac";
import { useAuth } from "@/components/auth-provider";
import { deleteBulletin, saveBulletin, type StoredBulletin } from "@/lib/bulletins-store";
import { toast } from "sonner";
import { withLocale } from "@/lib/paths";
import { useLocale } from "@/i18n/provider";

function csv(value: string): string[] {
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

const WEEKDAYS = ["1", "2", "3", "4", "5", "6", "7"];

export function BulletinEditor({ initial }: { initial: StoredBulletin }) {
  const t = useT();
  const { locale } = useLocale();
  const router = useRouter();
  const { user } = useAuth();
  const [draft, setDraft] = useState<StoredBulletin>(initial);
  const [recipientDraft, setRecipientDraft] = useState("");

  const allowNl = canUseNaturalLanguage(user?.plan);
  const allowPatents = canUsePatents(user?.plan);
  const nlOk = draft.nlQuery.trim().split(/\s+/).filter(Boolean).length >= 15;

  const preview = useMemo(() => {
    const included = draft.sections.flatMap((s) =>
      filterByAndLogic(DEMO_CANDIDATES, { companies: s.companies, competitors: [], technologies: s.technologies }),
    );
    const rejected = DEMO_CANDIDATES.filter((c) => !included.some((i) => i.id === c.id));
    return { included, rejected };
  }, [draft.sections]);

  function addRecipient() {
    const email = recipientDraft.trim().toLowerCase();
    if (!email.includes("@")) return;
    if (draft.recipients.includes(email)) return;
    setDraft({ ...draft, recipients: [...draft.recipients, email] });
    setRecipientDraft("");
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
    const first = draft.sections[0] ?? { title: "NL", companies: [], technologies: [] };
    setDraft({
      ...draft,
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
    saveBulletin({ ...draft, status: draft.status === "draft" ? "active" : draft.status });
    toast.success(t("bulletin.saved"));
    router.push(withLocale(locale, "/dashboard"));
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <h1 className="font-display text-3xl font-bold tracking-tight">
        {initial.name ? draft.name : t("dashboard.newBulletin")}
      </h1>
      <p className="text-sm text-muted-foreground">{t("bulletin.andHint")}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>{t("bulletin.name")}</Label>
          <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </div>
        <div>
          <Label>{t("bulletin.subject")}</Label>
          <Input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
        </div>
        <div>
          <Label>{t("bulletin.language")}</Label>
          <select
            className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            value={draft.language}
            onChange={(e) => setDraft({ ...draft, language: e.target.value })}
          >
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>{t("bulletin.frequency")}</Label>
          <select
            className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            value={draft.frequency}
            onChange={(e) => setDraft({ ...draft, frequency: e.target.value as StoredBulletin["frequency"] })}
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
            <Label>{t("bulletin.sendDay")}</Label>
            <select
              className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              value={String(draft.sendDay ?? 1)}
              onChange={(e) => setDraft({ ...draft, sendDay: Number(e.target.value) })}
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
          <Label>{t("bulletin.sendHour")}</Label>
          <Input type="number" min={0} max={23} value={draft.sendHour} onChange={(e) => setDraft({ ...draft, sendHour: Number(e.target.value) })} />
        </div>
        <div>
          <Label>{t("bulletin.timezone")}</Label>
          <Input value={draft.timezone} onChange={(e) => setDraft({ ...draft, timezone: e.target.value })} />
        </div>
      </div>

      <div>
        <Label>{t("bulletin.recipients")}</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {draft.recipients.map((email) => (
            <Badge key={email} variant="secondary" className="gap-1">
              {email}
              <button type="button" aria-label={t("bulletin.removeRecipient")} onClick={() => setDraft({ ...draft, recipients: draft.recipients.filter((r) => r !== email) })}>
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
          <Button type="button" variant="outline" onClick={addRecipient}>
            {t("bulletin.addRecipient")}
          </Button>
        </div>
      </div>

      {allowNl ? (
        <div className="rounded-xl border p-4">
          <Label>{t("bulletin.nlQuery")}</Label>
          <p className="mb-2 text-xs text-muted-foreground">
            {t("bulletin.nlOption")} · {t("bulletin.nlHint")}
          </p>
          <Textarea rows={4} value={draft.nlQuery} onChange={(e) => setDraft({ ...draft, nlQuery: e.target.value })} />
          <Button type="button" className="mt-3" variant="outline" onClick={() => void parseNl()}>
            {t("bulletin.parseNl")}
          </Button>
        </div>
      ) : null}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">{t("bulletin.matrix")}</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setDraft({
                ...draft,
                sections: [...draft.sections, { title: `Sección ${draft.sections.length + 1}`, companies: [], technologies: [] }],
              })
            }
          >
            {t("bulletin.addSection")}
          </Button>
        </div>
        <div className="space-y-4">
          {draft.sections.map((section, idx) => (
            <div key={idx} className="rounded-xl border p-4">
              <Input
                className="mb-3"
                value={section.title}
                onChange={(e) => {
                  const sections = [...draft.sections];
                  sections[idx] = { ...section, title: e.target.value };
                  setDraft({ ...draft, sections });
                }}
              />
              <Label>{t("bulletin.companies")}</Label>
              <Input
                className="mb-2"
                value={section.companies.join(", ")}
                onChange={(e) => {
                  const sections = [...draft.sections];
                  sections[idx] = { ...section, companies: csv(e.target.value) };
                  setDraft({ ...draft, sections });
                }}
              />
              <Label>{t("bulletin.technologies")}</Label>
              <Input
                value={section.technologies.join(", ")}
                onChange={(e) => {
                  const sections = [...draft.sections];
                  sections[idx] = { ...section, technologies: csv(e.target.value) };
                  setDraft({ ...draft, sections });
                }}
              />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-semibold">{t("bulletin.preview")}</h2>
        {!allowPatents ? <p className="mt-1 text-xs text-muted-foreground">{t("bulletin.starterHint")}</p> : null}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium">{t("bulletin.included")}</p>
            <ul className="space-y-2">
              {preview.included.map((item) => (
                <li key={item.id} className="rounded-lg border p-3 text-sm">
                  <Badge className="mb-1">{item.source}</Badge>
                  <p className="font-medium">{item.title}</p>
                </li>
              ))}
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
        {initial.name ? (
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              if (!window.confirm(t("bulletin.delete"))) return;
              deleteBulletin(draft.id);
              toast.success(t("bulletin.delete"));
              router.push(withLocale(locale, "/dashboard"));
            }}
          >
            {t("bulletin.delete")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
