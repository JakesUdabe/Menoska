"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { useLocale, useT } from "@/i18n/provider";
import { withLocale } from "@/lib/paths";
import { isOrgAdmin } from "@/lib/rbac";
import {
  addDesignPartnerNote,
  deleteDesignPartnerNote,
  listDesignPartnerNotes,
  type DesignPartnerNote,
} from "@/lib/design-partners-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function DesignPartnersPage() {
  const t = useT();
  const { locale } = useLocale();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [notes, setNotes] = useState<DesignPartnerNote[]>([]);
  const [partner, setPartner] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!loading && (!user || !isOrgAdmin(user.role))) {
      router.replace(withLocale(locale, "/dashboard"));
    }
  }, [loading, user, locale, router]);

  useEffect(() => {
    setNotes(listDesignPartnerNotes());
  }, []);

  if (loading || !user || !isOrgAdmin(user.role)) {
    return <div className="p-4 text-sm text-muted-foreground">{t("common.loading")}</div>;
  }

  function refresh() {
    setNotes(listDesignPartnerNotes());
  }

  function onAdd() {
    if (!partner.trim() || !note.trim()) {
      toast.error(t("designPartners.required"));
      return;
    }
    addDesignPartnerNote({ partner: partner.trim(), note: note.trim(), createdBy: user?.id });
    setPartner("");
    setNote("");
    refresh();
    toast.success(t("designPartners.saved"));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">{t("designPartners.eyebrow")}</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">{t("designPartners.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("designPartners.lead")}</p>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-card p-5">
        <div>
          <Label htmlFor="partner">{t("designPartners.partner")}</Label>
          <Input id="partner" value={partner} onChange={(e) => setPartner(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="note">{t("designPartners.note")}</Label>
          <textarea
            id="note"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <Button type="button" onClick={onAdd}>
          {t("designPartners.add")}
        </Button>
      </div>

      <ul className="space-y-3">
        {notes.length === 0 ? (
          <li className="text-sm text-muted-foreground">{t("designPartners.empty")}</li>
        ) : (
          notes.map((n) => (
            <li key={n.id} className="rounded-xl border border-border bg-card px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">{n.partner}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{n.note}</p>
                  <p className="mt-2 font-mono text-[10px] text-muted-foreground">{n.createdAt}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    deleteDesignPartnerNote(n.id);
                    refresh();
                  }}
                >
                  {t("common.delete")}
                </Button>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
