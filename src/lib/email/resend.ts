import { Resend } from "resend";

export function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export function resendFromAddress() {
  return process.env.RESEND_FROM_EMAIL ?? "Menoska Consulting <onboarding@resend.dev>";
}

export async function sendBulletinEmail(input: {
  to: string[];
  subject: string;
  html: string;
}): Promise<{ ok: true; id?: string } | { ok: false; error: string }> {
  const resend = getResend();
  if (!resend) return { ok: false, error: "resend_unconfigured" };
  if (!input.to.length) return { ok: false, error: "no_recipients" };
  try {
    const result = await resend.emails.send({
      from: resendFromAddress(),
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
    if (result.error) return { ok: false, error: result.error.message };
    return { ok: true, id: result.data?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "send_failed" };
  }
}
