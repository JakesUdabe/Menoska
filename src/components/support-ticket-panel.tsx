"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useT } from "@/i18n/provider";
import { Button } from "@/components/ui/button";

const SUPPORT_EMAIL = "soporte@menoska.com";

function newTicketId(): string {
  const part =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8).toUpperCase()
      : Math.random().toString(36).slice(2, 10).toUpperCase();
  return `MC-${part}`;
}

export function SupportTicketPanel() {
  const t = useT();
  const [ticketId, setTicketId] = useState(() => newTicketId());

  const mailto = useMemo(() => {
    const subject = encodeURIComponent(`[Menoska] Ticket ${ticketId}`);
    const body = encodeURIComponent(
      `Ticket ID: ${ticketId}\n\nDescribe el problema:\n\n`,
    );
    return `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  }, [ticketId]);

  async function copyId() {
    try {
      await navigator.clipboard.writeText(ticketId);
      toast.success(t("support.ticketCopied"));
    } catch {
      toast.message(ticketId);
    }
  }

  return (
    <div className="mt-6 space-y-3 rounded-xl border border-border bg-muted/30 p-4">
      <h2 className="font-display text-lg font-semibold text-ink">{t("support.ticketTitle")}</h2>
      <p className="text-sm text-muted-foreground">{t("support.ticketLead")}</p>
      <p className="font-mono text-sm text-primary">{ticketId}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => void copyId()}>
          {t("support.copyTicket")}
        </Button>
        <Button type="button" asChild>
          <a href={mailto}>{t("support.mailto")}</a>
        </Button>
        <Button type="button" variant="secondary" onClick={() => setTicketId(newTicketId())}>
          {t("support.newTicket")}
        </Button>
      </div>
    </div>
  );
}
