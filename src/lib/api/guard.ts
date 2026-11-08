import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { clientIp, rateLimit } from "./rate-limit";
import { isApiKeyBearer, resolveApiKeyBearer } from "@/lib/api-keys";

export type GuardOk = {
  ok: true;
  userId: string;
  demo: boolean;
  organizationId?: string | null;
  viaApiKey?: boolean;
};
export type GuardFail = { ok: false; response: NextResponse };

function requestPath(request: Request): string {
  try {
    return new URL(request.url).pathname;
  } catch {
    return "";
  }
}

/** Require Bearer/cookie session when Supabase is configured; demo allows x-demo-user-id.
 *  Opaque `mk_…` API keys are accepted only on `/api/v1/*`. */
export async function requireApiAuth(request: Request, rateKeyPrefix = "api"): Promise<GuardOk | GuardFail> {
  const ip = clientIp(request);
  const limited = rateLimit(`${rateKeyPrefix}:${ip}`, 30, 60_000);
  if (!limited.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
      ),
    };
  }

  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const path = requestPath(request);
  const onV1 = path.startsWith("/api/v1");

  if (bearer && isApiKeyBearer(bearer)) {
    if (!onV1) {
      return { ok: false, response: NextResponse.json({ error: "api_key_v1_only" }, { status: 401 }) };
    }
    const resolved = await resolveApiKeyBearer(bearer);
    if (!resolved) {
      return { ok: false, response: NextResponse.json({ error: "auth" }, { status: 401 }) };
    }
    return {
      ok: true,
      userId: resolved.userId,
      demo: resolved.demo,
      organizationId: resolved.organizationId,
      viaApiKey: true,
    };
  }

  if (!isSupabaseConfigured()) {
    const demoUserId = request.headers.get("x-demo-user-id")?.trim();
    if (!demoUserId) {
      return { ok: false, response: NextResponse.json({ error: "demo_auth_required" }, { status: 401 }) };
    }
    return { ok: true, userId: demoUserId, demo: true };
  }

  const supabase = await createServerSupabase();
  if (!supabase) {
    return { ok: false, response: NextResponse.json({ error: "auth" }, { status: 401 }) };
  }

  if (bearer) {
    const { data, error } = await supabase.auth.getUser(bearer);
    if (error || !data.user) {
      return { ok: false, response: NextResponse.json({ error: "auth" }, { status: 401 }) };
    }
    return { ok: true, userId: data.user.id, demo: false };
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { ok: false, response: NextResponse.json({ error: "auth" }, { status: 401 }) };
  }
  return { ok: true, userId: data.user.id, demo: false };
}
