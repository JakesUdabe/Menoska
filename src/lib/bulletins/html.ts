import { renderMenoskaEmail } from "@/lib/email/layout";
import { filterByAndLogic, type CandidateItem } from "@/lib/and-filter";
import { DEMO_CANDIDATES } from "@/lib/demo-data";
import { commonCriteria, type StoredBulletin } from "@/lib/bulletins-store";

export function pickBulletinItems(bulletin: StoredBulletin, candidates: CandidateItem[] = DEMO_CANDIDATES): CandidateItem[] {
  const criteria = commonCriteria(bulletin);
  const matched = filterByAndLogic(candidates, criteria);
  return matched.slice(0, bulletin.maxItems || 10);
}

export function buildBulletinHtml(
  bulletin: StoredBulletin,
  items: CandidateItem[],
  opts?: { orgName?: string },
): string {
  const orgName = opts?.orgName?.trim() || "Menoska Consulting";
  const preheader =
    items.length > 0
      ? `${items.length} update${items.length === 1 ? "" : "s"} · ${bulletin.subject || bulletin.name}`
      : `No new items this cycle · ${bulletin.name}`;

  const rows =
    items.length > 0
      ? items
          .map(
            (item) => `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border-bottom:1px solid #D5DEDA;">
        <tr>
          <td style="padding:0 0 14px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#5A6B72;">${escapeHtml(item.source)}${item.company ? ` · ${escapeHtml(item.company)}` : ""}</div>
            <a href="${escapeAttr(item.url)}" style="color:#00895B;font-family:Georgia,'Times New Roman',serif;font-weight:700;text-decoration:none;font-size:16px;">${escapeHtml(item.title)}</a>
            <p style="margin:6px 0 0;color:#2A383E;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;">${escapeHtml(item.body)}</p>
          </td>
        </tr>
      </table>`,
          )
          .join("")
      : `<p style="margin:0;color:#5A6B72;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;">Nothing matched your filters in this cycle. We will check again on the next send.</p>`;

  const inner = `<p style="margin:0 0 6px;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.3;color:#394A51;">${escapeHtml(bulletin.name)}</p>
<p style="margin:0 0 18px;color:#5A6B72;font-family:Arial,Helvetica,sans-serif;font-size:14px;">${escapeHtml(bulletin.subject)}</p>
${rows}
<p style="margin:18px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#5A6B72;">Prepared for ${escapeHtml(orgName)}. Briefings are informational and are not legal or investment advice.</p>`;

  return renderMenoskaEmail({
    lang: "en",
    preheader,
    innerHtml: inner,
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value: string) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
