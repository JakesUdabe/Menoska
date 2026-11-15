/** Domain types for the human-in-the-loop sales outreach module. */

export type SalesLeadStatus = "new" | "contacted" | "replied" | "client" | "blacklisted";

export type OutboundDraftStatus =
  | "pending_validation"
  | "approved"
  | "rejected"
  | "sent"
  | "failed";

export type SentimentIntent = "interested" | "objection" | "not_interested" | "unsubscribe";

export type InboundReplyStatus = "pending_validation" | "approved" | "sent";

export type SuppressionReason = "subscribed_client" | "unsubscribed" | "opt_out" | "manual_block";

export type DedupBadge = "clean" | "company_recent" | "overridden" | "excluded_existing_client";

export type DedupReason = "person" | "company" | "suppression" | "missing_lead";

export type LeadFilters = {
  status?: SalesLeadStatus | "all";
  industry?: string;
  companySize?: string;
  /** Include leads never contacted, or last contacted on/before this YYYY-MM-DD. */
  lastContactedOnOrBefore?: string;
};

export interface SalesStartup {
  id: string;
  name: string;
  domain: string;
  fromName: string;
  fromEmail: string;
  tone: string;
  valueProposition: string;
  signature: string;
  calendlyUrl: string | null;
  /** Max messages dispatched per day for this sending domain. */
  dailySendCap: number;
}

export interface SalesLead {
  id: string;
  name: string;
  email: string;
  company_name: string;
  cif: string | null;
  company_website: string | null;
  linkedin_url: string | null;
  industry: string | null;
  company_size: string | null;
  position: string | null;
  status: SalesLeadStatus;
  startup_id: string;
  exclusion_tag: string | null;
  last_contacted_at: string | null;
}

export interface OutboundDraft {
  id: string;
  lead_id: string;
  startup_id: string;
  subject: string;
  body: string;
  status: OutboundDraftStatus;
  ai_context: string | null;
  dedup_badge: DedupBadge;
  generated_at: string;
  validated_at: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  lead?: SalesLead;
}

export interface InboundReply {
  id: string;
  outreach_id: string;
  lead_id: string;
  startup_id: string;
  received_text: string;
  sentiment_intent: SentimentIntent;
  suggested_reply_subject: string | null;
  suggested_reply_body: string | null;
  status: InboundReplyStatus;
  received_at: string;
  lead?: SalesLead;
}

export interface SuppressionEntry {
  id: string;
  domain_or_email: string;
  company_name: string | null;
  reason: SuppressionReason;
}

export interface OutreachMetrics {
  generated: number;
  approved: number;
  sent: number;
  opened: number;
  replied: number;
  bounced: number;
}
