"use client";

import { useState } from "react";
import { Loader2, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/i18n/provider";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export default function DashboardContactPage() {
  const t = useT();
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = message.trim();
    if (trimmed.length < 5) {
      toast.error(t("dashboardContact.messageTooShort"));
      return;
    }
    if (!consent) {
      toast.error(t("dashboardContact.errorConsent"));
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: user?.fullName || "Usuario",
          email: user?.email || "unknown@abinews.com",
          company: user?.organizationName || "ABI News",
          message: trimmed,
        }),
      });
      if (!res.ok) throw new Error("send");
      toast.success(t("dashboardContact.sent"));
      setMessage("");
      setConsent(false);
    } catch {
      toast.error(t("dashboardContact.sendError"));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">{t("dashboardContact.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("dashboardContact.subtitle")}</p>
      </div>
      <div className="space-y-4 rounded-xl border bg-card p-6">
        <div className="space-y-1 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">{t("dashboardContact.fromName")}:</span> {user?.fullName || "—"}
          </p>
          <p>
            <span className="font-medium text-foreground">{t("dashboardContact.fromCompany")}:</span> {user?.organizationName || "—"}
          </p>
          <p className="flex items-center gap-1.5">
            <Mail className="size-3.5" />
            <span className="font-medium text-foreground">{t("dashboardContact.fromEmail")}:</span> {user?.email || "—"}
          </p>
        </div>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          <div>
            <Label htmlFor="dashboard-contact-message">{t("dashboardContact.message")}</Label>
            <Textarea
              id="dashboard-contact-message"
              rows={7}
              value={message}
              maxLength={2000}
              disabled={sending}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("dashboardContact.placeholder")}
              className="mt-1.5"
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">{message.trim().length}/2000</p>
          </div>
          <div className="flex items-start gap-3">
            <Checkbox id="dashboard-contact-consent" checked={consent} onCheckedChange={(v) => setConsent(v === true)} />
            <Label htmlFor="dashboard-contact-consent" className="font-normal leading-snug">
              {t("dashboardContact.consent")}
            </Label>
          </div>
          <Button type="submit" disabled={sending}>
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {t("dashboardContact.send")}
          </Button>
        </form>
      </div>
    </div>
  );
}
