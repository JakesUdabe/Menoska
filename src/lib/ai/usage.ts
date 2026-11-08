import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { maxAiGenerationsPerMonth, type PlanType } from "@/lib/rbac";

export type AiUsageKind = "nl_query" | "report_generate" | string;

export type RecordAiUsageInput = {
  userId: string;
  organizationId?: string | null;
  kind: AiUsageKind;
  tokensIn?: number;
  tokensOut?: number;
  meta?: Record<string, unknown>;
};

/** Rough token estimate when the model does not return usage. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

const memoryEvents: Array<RecordAiUsageInput & { at: string }> = [];

function monthStartIso(d = new Date()): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

/** Append AI usage for metering. Demo: in-memory; production: mc_ai_usage_events. */
export async function recordAiUsage(input: RecordAiUsageInput): Promise<void> {
  const tokensIn = input.tokensIn ?? 0;
  const tokensOut = input.tokensOut ?? 0;
  const meta = input.meta ?? {};

  if (!isSupabaseConfigured()) {
    memoryEvents.push({ ...input, tokensIn, tokensOut, meta, at: new Date().toISOString() });
    if (memoryEvents.length > 500) memoryEvents.shift();
    return;
  }

  const row = {
    user_id: input.userId,
    organization_id: input.organizationId || null,
    kind: input.kind,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    meta,
  };

  try {
    const supabase = await createServerSupabase();
    if (supabase) {
      const { error } = await supabase.from("mc_ai_usage_events").insert(row);
      if (!error) return;
      console.warn("mc_ai_usage_events insert (user) skipped", error.message);
    }
    const admin = createAdminSupabase();
    if (admin) {
      const { error: adminErr } = await admin.from("mc_ai_usage_events").insert(row);
      if (adminErr) console.warn("mc_ai_usage_events insert (admin) skipped", adminErr.message);
    }
  } catch (err) {
    console.warn("recordAiUsage failed", err);
  }
}

/** Count AI generations this calendar month (demo memory or mc_ai_usage_events). */
export async function countAiUsageThisMonth(opts: {
  userId: string;
  organizationId?: string | null;
}): Promise<number> {
  const since = monthStartIso();

  if (!isSupabaseConfigured()) {
    return memoryEvents.filter((e) => {
      if (e.at < since) return false;
      if (opts.organizationId) return e.organizationId === opts.organizationId;
      return e.userId === opts.userId;
    }).length;
  }

  try {
    const supabase = await createServerSupabase();
    if (!supabase) return 0;
    let query = supabase
      .from("mc_ai_usage_events")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since);
    if (opts.organizationId) {
      query = query.eq("organization_id", opts.organizationId);
    } else {
      query = query.eq("user_id", opts.userId);
    }
    const { count, error } = await query;
    if (error) {
      console.warn("mc_ai_usage_events count failed", error.message);
      return 0;
    }
    return count ?? 0;
  } catch (err) {
    console.warn("countAiUsageThisMonth failed", err);
    return 0;
  }
}

/** Read demo add-on AI bump from `x-demo-extra-ai` (client sets from menoska_quota_overrides). */
export function extraAiFromRequest(request: Request): number {
  const raw = request.headers.get("x-demo-extra-ai");
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** 429 if plan monthly AI quota is exceeded. Enterprise (null) never blocks.
 *  `extraAi` bumps the cap (demo add-on overrides via x-demo-extra-ai or client). */
export async function assertAiQuota(opts: {
  userId: string;
  organizationId?: string | null;
  plan: PlanType | null | undefined;
  extraAi?: number;
}): Promise<NextResponse | null> {
  const base = maxAiGenerationsPerMonth(opts.plan);
  if (base === null) return null;
  const cap = base + Math.max(0, opts.extraAi ?? 0);
  const used = await countAiUsageThisMonth({
    userId: opts.userId,
    organizationId: opts.organizationId,
  });
  if (used >= cap) {
    return NextResponse.json({ error: "quota_exceeded" }, { status: 429 });
  }
  return null;
}

/** Test / debug helper for demo mode. */
export function listMemoryAiUsage() {
  return [...memoryEvents];
}

/** Reset in-memory usage (tests). */
export function clearMemoryAiUsage() {
  memoryEvents.length = 0;
}
