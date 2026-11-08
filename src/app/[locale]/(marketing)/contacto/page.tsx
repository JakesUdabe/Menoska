"use client";

import { useState } from "react";
import { z } from "zod";
import { useT } from "@/i18n/provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  company: z.string().min(2),
  message: z.string().min(12),
});

export default function ContactPage() {
  const t = useT();
  const [status, setStatus] = useState<"idle" | "ok" | "err" | "invalid">("idle");
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    const parsed = schema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      company: formData.get("company"),
      message: formData.get("message"),
    });
    if (!parsed.success) {
      setStatus("invalid");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      setStatus(res.ok ? "ok" : "err");
    } catch {
      setStatus("err");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mesh-hero mx-auto max-w-xl px-4 py-16">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-signal">{t("contact.eyebrow")}</p>
      <h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">{t("contact.title")}</h1>
      <p className="mt-4 text-muted-foreground">{t("contact.lead")}</p>
      <form
        className="mt-8 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit(new FormData(e.currentTarget));
        }}
      >
        <div>
          <Label htmlFor="name">{t("contact.name")}</Label>
          <Input id="name" name="name" required autoComplete="name" />
        </div>
        <div>
          <Label htmlFor="email">{t("contact.email")}</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <Label htmlFor="company">{t("contact.company")}</Label>
          <Input id="company" name="company" required autoComplete="organization" />
        </div>
        <div>
          <Label htmlFor="message">{t("contact.message")}</Label>
          <Textarea id="message" name="message" required rows={5} />
        </div>
        <Button type="submit" disabled={pending}>
          {t("contact.submit")}
        </Button>
        {status === "ok" ? <p className="text-sm text-signal">{t("contact.success")}</p> : null}
        {status === "err" ? <p className="text-sm text-destructive">{t("contact.error")}</p> : null}
        {status === "invalid" ? <p className="text-sm text-destructive">{t("contact.validation")}</p> : null}
      </form>
    </div>
  );
}
