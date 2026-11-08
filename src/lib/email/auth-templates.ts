import { emailButton, renderMenoskaEmail } from "./layout";

/** Supabase Auth templates. Placeholders are Go templates and must stay literal. */

function page(preheader: string, innerHtml: string): string {
  return renderMenoskaEmail({ lang: "en", preheader, innerHtml });
}

export const AUTH_MAIL = {
  confirmation: {
    subject: "Confirm your Menoska Consulting account",
    content: page(
      "Confirm your email to open your Menoska Consulting account.",
      `<p style="margin:0 0 12px;">Welcome to Menoska Consulting.</p>
<p style="margin:0;">Confirm your email address to activate your account. The link expires after a short time.</p>
${emailButton("{{ .ConfirmationURL }}", "Confirm email")}`,
    ),
  },
  recovery: {
    subject: "Reset your Menoska Consulting password",
    content: page(
      "Use this link to choose a new password.",
      `<p style="margin:0 0 12px;">We received a request to reset the password for your Menoska Consulting account.</p>
<p style="margin:0;">If you did not ask for this, you can ignore this email. Your password will stay the same.</p>
${emailButton("{{ .ConfirmationURL }}", "Reset password")}`,
    ),
  },
  magicLink: {
    subject: "Your Menoska Consulting sign-in link",
    content: page(
      "Use this link to sign in. It expires shortly.",
      `<p style="margin:0;">Use the button below to sign in to Menoska Consulting. This link can only be used once.</p>
${emailButton("{{ .ConfirmationURL }}", "Sign in")}`,
    ),
  },
  emailChange: {
    subject: "Confirm your new email address",
    content: page(
      "Confirm the change from your current email to the new one.",
      `<p style="margin:0 0 12px;">Confirm that <strong>{{ .Email }}</strong> should be changed to <strong>{{ .NewEmail }}</strong> on your Menoska Consulting account.</p>
<p style="margin:0;">If you did not request this change, ignore this email.</p>
${emailButton("{{ .ConfirmationURL }}", "Confirm new email")}`,
    ),
  },
  invite: {
    subject: "You are invited to Menoska Consulting",
    content: page(
      "Accept your invitation to Menoska Consulting.",
      `<p style="margin:0;">You have been invited to join Menoska Consulting. Accept the invitation to create your account.</p>
${emailButton("{{ .ConfirmationURL }}", "Accept invitation")}`,
    ),
  },
  reauthentication: {
    subject: "Your Menoska Consulting verification code",
    content: page(
      "Enter this code to confirm it is you.",
      `<p style="margin:0 0 12px;">Enter this code to confirm your identity:</p>
<p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:28px;letter-spacing:0.12em;color:#00895B;">{{ .Token }}</p>`,
    ),
  },
} as const;
