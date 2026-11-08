import { isSupabaseConfigured, createClient } from "@/lib/supabase/client";
import {
  clearWorksheet as clearLocal,
  loadWorksheet as loadLocal,
  persistWorksheet as persistLocal,
} from "@/lib/worksheets-store";

export async function loadWorksheet<T>(
  toolId: string,
  opts?: { userId?: string | null },
): Promise<T | null> {
  if (!isSupabaseConfigured() || !opts?.userId) {
    return loadLocal<T>(toolId);
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("mc_worksheets")
    .select("data")
    .eq("user_id", opts.userId)
    .eq("tool_id", toolId)
    .maybeSingle();
  if (error) {
    console.warn("mc_worksheets load failed", error.message);
    return loadLocal<T>(toolId);
  }
  if (data?.data !== undefined && data.data !== null) {
    return data.data as T;
  }
  return loadLocal<T>(toolId);
}

export async function persistWorksheet(
  toolId: string,
  data: unknown,
  opts?: { userId?: string | null; organizationId?: string | null },
): Promise<void> {
  persistLocal(toolId, data);
  if (!isSupabaseConfigured() || !opts?.userId || !opts.organizationId) return;

  const supabase = createClient();
  const { error } = await supabase.from("mc_worksheets").upsert(
    {
      user_id: opts.userId,
      organization_id: opts.organizationId,
      tool_id: toolId,
      data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,tool_id" },
  );
  if (error) console.warn("mc_worksheets upsert failed", error.message);
}

export async function clearWorksheet(
  toolId: string,
  opts?: { userId?: string | null },
): Promise<void> {
  clearLocal(toolId);
  if (!isSupabaseConfigured() || !opts?.userId) return;
  const supabase = createClient();
  const { error } = await supabase.from("mc_worksheets").delete().eq("user_id", opts.userId).eq("tool_id", toolId);
  if (error) console.warn("mc_worksheets delete failed", error.message);
}
