import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/dashboard/integrations/supabase/client";
import { useAuth } from "@/dashboard/contexts/AuthContext";
import { isSuperAdmin } from "@/dashboard/lib/rbac";
import type { StaffProfile } from "@/dashboard/types/admin";

export function useStaffProfiles() {
  const [profiles, setProfiles] = useState<StaffProfile[]>([]);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, role, job_title, work_email, calendly_url")
        .in("role", ["admin", "empleado"]);
      setProfiles(
        ((data ?? []) as Array<{
          id: string;
          full_name: string | null;
          role: StaffProfile["role"];
          job_title: string | null;
          work_email: string | null;
          calendly_url: string | null;
        }>).map((row) => ({
          user_id: row.id,
          full_name: row.full_name,
          role: row.role,
          job_title: row.job_title,
          work_email: row.work_email,
          calendly_url: row.calendly_url,
        })),
      );
    })();
  }, []);

  return profiles;
}

export function useTargetUserId() {
  const { user, profile } = useAuth();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const isAdmin = isSuperAdmin(profile?.role);

  const effectiveUserId = isAdmin && selectedUserId ? selectedUserId : user?.id ?? null;

  useEffect(() => {
    if (user?.id && !selectedUserId) {
      setSelectedUserId(user.id);
    }
  }, [user?.id, selectedUserId]);

  return { effectiveUserId, selectedUserId, setSelectedUserId, isAdmin };
}

export async function invokeAdminFunction<T>(
  name: string,
  fallbackError: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  const payload = (data ?? {}) as Record<string, unknown>;

  if (payload.ok === false && typeof payload.error === "string") {
    throw new Error(payload.error);
  }
  if (error) {
    let detail = error.message || fallbackError;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const body = (await ctx.json()) as Record<string, unknown>;
        if (typeof body.error === "string") detail = body.error;
        else if (typeof body.message === "string") detail = body.message;
      }
    } catch {
      // ignore parse failures
    }
    if (typeof payload.error === "string") detail = payload.error;
    throw new Error(detail);
  }
  return payload as T;
}

export function useAsyncAction() {
  const [loading, setLoading] = useState(false);

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    setLoading(true);
    try {
      return await fn();
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, run };
}
