/** Email-safe shell. Mailbox clients drop SVG, so the logo is the wordmark in brand type. */

const EMERALD = "#00895B";
const INK = "#394A51";
const TEXT = "#2A383E";
const MUTED = "#5A6B72";
const PAPER = "#F5F8F7";
const LINE = "#D5DEDA";

export function renderMenoskaEmail(input: { lang?: string; preheader: string; innerHtml: string }): string {
  const lang = input.lang || "en";
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="${lang}">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Menoska Consulting</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${PAPER};">${input.preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid ${LINE};border-radius:8px;overflow:hidden;">
          <tr><td style="height:4px;background:${EMERALD};font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td style="padding:28px 32px 8px;">
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1;color:${EMERALD};">Menoska</div>
              <div style="margin-top:4px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1;letter-spacing:0.04em;color:${INK};">Consulting</div>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:${TEXT};">
              ${input.innerHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 22px;border-top:1px solid ${LINE};font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${MUTED};">
              Menoska Consulting · From technology watch to the financial decision<br />
              This message was sent by noreply@menoska-consulting.com. Please do not reply.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function emailButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 8px;">
  <tr>
    <td bgcolor="${EMERALD}" style="border-radius:4px;">
      <a href="${href}" style="display:inline-block;padding:12px 22px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#F4FAF7;text-decoration:none;">${label}</a>
    </td>
  </tr>
</table>`;
}
