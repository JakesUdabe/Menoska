"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useT } from "@/i18n/provider";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured, createClient } from "@/lib/supabase/client";
import { listBulletinDeliveries } from "@/lib/bulletin-deliveries-store";

const DISMISS_KEY = "menoska_nps_dismissed";
const SCORE_KEY = "menoska_nps_score";
const FIRST_SEEN_KEY = "menoska_nps_first_seen";
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function shouldShow(): boolean {
  try {
    if (localStorage.getItem(SCORE_KEY)) return false;
    if (localStorage.getItem(DISMISS_KEY) === "1") return false;
    const firstSeen = localStorage.getItem(FIRST_SEEN_KEY);
    const now = Date.now();
    if (!firstSeen) {
      localStorage.setItem(FIRST_SEEN_KEY, String(now));
      return false;
    }
    const elapsed = now - Number(firstSeen);
    const hasSend = listBulletinDeliveries().length > 0;
    return hasSend || elapsed >= THREE_DAYS_MS;
  } catch {
    return false;
  }
}

export function NpsSurvey() {
  const t = useT();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setOpen(shouldShow());
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  async function submit() {
    if (score == null) return;
    setSaving(true);
    try {
      localStorage.setItem(SCORE_KEY, String(score));
      localStorage.setItem(
        "menoska_nps_payload",
        JSON.stringify({ score, comment, at: new Date().toISOString() }),
      );
      if (isSupabaseConfigured() && user) {
        const supabase = createClient();
        await supabase.from("mc_nps_responses").insert({
          user_id: user.id,
          organization_id: user.organizationId,
          score,
          comment: comment.trim() || null,
        });
      }
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[min(100vw-2rem,22rem)] rounded-xl border border-border bg-card p-4 shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-primary">{t("nps.badge")}</p>
          <p className="mt-1 text-sm font-medium text-foreground">{t("nps.question")}</p>
        </div>
        <button type="button" className="text-muted-foreground hover:text-foreground" onClick={dismiss} aria-label={t("common.cancel")}>
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {Array.from({ length: 11 }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setScore(i)}
            className={`size-7 rounded-md text-xs font-medium transition-colors ${
              score === i ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            {i}
          </button>
        ))}
      </div>
      <p className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{t("nps.low")}</span>
        <span>{t("nps.high")}</span>
      </p>
      <textarea
        className="mt-3 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
        rows={2}
        placeholder={t("nps.comment")}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <Button type="button" size="sm" className="mt-2 w-full" disabled={score == null || saving} onClick={() => void submit()}>
        {t("nps.submit")}
      </Button>
    </div>
  );
}
