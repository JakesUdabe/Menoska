"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { useT } from "@/i18n/provider";
import { demoApiHeaders } from "@/lib/api/demo-headers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { writeStorage, readMigratedStorage } from "@/lib/storage-keys";
import { listProjectsForUser, saveProject } from "@/lib/projects-repository";
import { isOrgAdmin } from "@/lib/rbac";
import {
  SHOWCASE_CASE,
  SHOWCASE_PROJECT_ID,
  formatEur,
  showcaseProfitAfterShock,
  showcaseSam,
  showcaseSom,
} from "@/lib/showcase-case";

const PUBLISHED_KEY = "menoska_investment_memos";

type MemoDraft = {
  markdown: string;
  status: "pending_approval" | "approved" | "rejected" | "published";
  company: string;
  at: string;
  linkedProjectId?: string;
};

export default function MemoInversionPage() {
  const t = useT();
  const { user } = useAuth();
  const [company, setCompany] = useState(SHOWCASE_CASE.company);
  const [thesis, setThesis] = useState(SHOWCASE_CASE.thesis);
  const [sector, setSector] = useState(SHOWCASE_CASE.sector);
  const [ticketEur, setTicketEur] = useState(String(SHOWCASE_CASE.ticketEur));
  const [risks, setRisks] = useState(SHOWCASE_CASE.risks);
  const [tamEur, setTamEur] = useState(SHOWCASE_CASE.tamEur);
  const [geoShare, setGeoShare] = useState(SHOWCASE_CASE.geoShare);
  const [segmentShare, setSegmentShare] = useState(SHOWCASE_CASE.segmentShare);
  const [captureShare, setCaptureShare] = useState(SHOWCASE_CASE.captureShare);
  const [fit, setFit] = useState<"build" | "buy" | "partner">(SHOWCASE_CASE.fit);
  const [priceShockPct, setPriceShockPct] = useState(SHOWCASE_CASE.priceShockPct);
  const sam = showcaseSam({ tamEur, geoShare, segmentShare });
  const som = showcaseSom({ tamEur, geoShare, segmentShare, captureShare });
  const shocked = showcaseProfitAfterShock(priceShockPct);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<MemoDraft | null>(null);

  async function generate() {
    if (!company.trim() || !thesis.trim()) {
      toast.error(t("memo.required"));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/agents/investment-memo", {
        method: "POST",
        headers: { "content-type": "application/json", ...demoApiHeaders(user) },
        body: JSON.stringify({
          company: company.trim(),
          thesis: thesis.trim(),
          sector: sector.trim() || undefined,
          ticketEur: ticketEur ? Number(ticketEur) : undefined,
          risks: risks.trim() || undefined,
          tamEur,
          geoShare,
          segmentShare,
          captureShare,
          fit,
          priceShockPct,
        }),
      });
      const data = (await res.json()) as { markdown?: string; error?: string; status?: string };
      if (!res.ok || !data.markdown) {
        toast.error(data.error ?? t("memo.error"));
        return;
      }
      setDraft({
        markdown: data.markdown,
        status: "pending_approval",
        company: company.trim(),
        at: new Date().toISOString(),
      });
      toast.success(t("memo.draftReady"));
    } finally {
      setLoading(false);
    }
  }

  async function setStatus(status: MemoDraft["status"]) {
    if (!draft) return;
    const next = { ...draft, status };
    if (status === "approved" && user) {
      try {
        const seeOrg = isOrgAdmin(user.role);
        const projects = await listProjectsForUser(user.id, user.organizationId, seeOrg);
        const target =
          projects.find((p) => p.id === SHOWCASE_PROJECT_ID) ??
          projects.find((p) => p.status === "active") ??
          projects[0];
        if (target) {
          const linkId =
            typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `lnk-${Date.now()}`;
          const already = target.links.some((l) => l.kind === "other" && l.refId === `memo:${draft.company}`);
          if (!already) {
            await saveProject({
              ...target,
              links: [
                ...target.links,
                {
                  id: linkId,
                  kind: "other",
                  refId: `memo:${draft.company}`,
                  label: `Memo · ${draft.company}`,
                  createdAt: new Date().toISOString(),
                },
              ],
            });
          }
          next.linkedProjectId = target.id;
          toast.success(`${t("memo.approved")} · ${t("memo.linkedProject")}: ${target.name}`);
        } else {
          toast.message(t("memo.approved"));
        }
      } catch {
        toast.message(t("memo.approved"));
      }
    } else if (status === "published") {
      try {
        const raw = readMigratedStorage(PUBLISHED_KEY, "abi_investment_memos");
        const list = raw ? (JSON.parse(raw) as MemoDraft[]) : [];
        list.unshift(next);
        writeStorage(PUBLISHED_KEY, JSON.stringify(list.slice(0, 50)));
      } catch {
        /* ignore */
      }
      toast.success(t("memo.published"));
    } else {
      toast.message(t("memo.rejected"));
    }
    setDraft(next);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">{t("memo.eyebrow")}</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">{t("memo.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("memo.lead")}</p>
      </div>

      <div className="grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="company">{t("memo.company")}</Label>
          <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="sector">{t("memo.sector")}</Label>
          <Input id="sector" value={sector} onChange={(e) => setSector(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="ticket">{t("memo.ticket")}</Label>
          <Input id="ticket" type="number" value={ticketEur} onChange={(e) => setTicketEur(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="thesis">{t("memo.thesis")}</Label>
          <textarea
            id="thesis"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            rows={4}
            value={thesis}
            onChange={(e) => setThesis(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="risks">{t("memo.risks")}</Label>
          <textarea
            id="risks"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            rows={2}
            value={risks}
            onChange={(e) => setRisks(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2 border-t border-border pt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">{t("memo.market")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("memo.marketHint")}</p>
        </div>
        <div>
          <Label htmlFor="tam">{t("memo.tam")}</Label>
          <Input id="tam" type="number" value={tamEur} onChange={(e) => setTamEur(Number(e.target.value) || 0)} />
        </div>
        <div>
          <Label htmlFor="geo">{t("memo.geo")}</Label>
          <Input id="geo" type="number" value={geoShare} onChange={(e) => setGeoShare(Number(e.target.value) || 0)} />
        </div>
        <div>
          <Label htmlFor="segment">{t("memo.segment")}</Label>
          <Input id="segment" type="number" value={segmentShare} onChange={(e) => setSegmentShare(Number(e.target.value) || 0)} />
        </div>
        <div>
          <Label htmlFor="capture">{t("memo.capture")}</Label>
          <Input id="capture" type="number" value={captureShare} onChange={(e) => setCaptureShare(Number(e.target.value) || 0)} />
        </div>
        <p className="sm:col-span-2 text-sm text-muted-foreground">
          SAM {formatEur(sam)} · SOM {formatEur(som)}
        </p>
        <div className="sm:col-span-2 border-t border-border pt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">{t("memo.fitLabel")}</p>
        </div>
        <div className="sm:col-span-2 flex flex-wrap gap-2">
          {(["build", "buy", "partner"] as const).map((option) => (
            <Button key={option} type="button" size="sm" variant={fit === option ? "default" : "outline"} onClick={() => setFit(option)}>
              {t(option === "build" ? "memo.fitBuild" : option === "buy" ? "memo.fitBuy" : "memo.fitPartner")}
            </Button>
          ))}
        </div>
        <div className="sm:col-span-2 border-t border-border pt-4">
          <Label htmlFor="shock">{t("memo.shock")}</Label>
          <Input id="shock" type="number" value={priceShockPct} onChange={(e) => setPriceShockPct(Number(e.target.value) || 0)} />
          <p className="mt-2 text-sm text-muted-foreground">
            {t("memo.shockResult")}: {formatEur(shocked)}
          </p>
        </div>
        <div className="sm:col-span-2">
          <Button type="button" disabled={loading} onClick={() => void generate()}>
            {loading ? t("common.loading") : t("memo.generate")}
          </Button>
        </div>
      </div>

      {draft ? (
        <div className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-primary">
              {t("memo.hitl")} · {draft.status}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => void setStatus("rejected")} disabled={draft.status === "published"}>
                {t("memo.reject")}
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => void setStatus("approved")} disabled={draft.status === "published"}>
                {t("memo.approve")}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void setStatus("published")}
                disabled={draft.status !== "approved"}
              >
                {t("memo.publish")}
              </Button>
            </div>
          </div>
          <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-lg bg-muted/40 p-4 text-xs leading-relaxed text-foreground">
            {draft.markdown}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
