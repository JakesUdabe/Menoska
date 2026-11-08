import { readMigratedStorage } from "@/lib/storage-keys";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export type NpsAggregate = {
  average: number | null;
  count: number;
  source: "local" | "supabase" | "empty";
};

/** Aggregate NPS from localStorage payload(s) and optional Supabase rows. */
export async function getNpsAggregate(): Promise<NpsAggregate> {
  const scores: number[] = [];

  try {
    const single = typeof window !== "undefined" ? localStorage.getItem("menoska_nps_score") : null;
    if (single != null && single !== "") {
      const n = Number(single);
      if (Number.isFinite(n)) scores.push(n);
    }
    const raw = typeof window !== "undefined" ? readMigratedStorage("menoska_nps_payload", "abi_nps_payload") : null;
    if (raw) {
      const parsed = JSON.parse(raw) as { score?: number };
      if (typeof parsed.score === "number") scores.push(parsed.score);
    }
  } catch {
    /* ignore */
  }

  if (isSupabaseConfigured() && typeof window !== "undefined") {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data } = await supabase.from("mc_nps_responses").select("score").limit(500);
      for (const row of data ?? []) {
        const s = (row as { score?: number }).score;
        if (typeof s === "number") scores.push(s);
      }
      if (scores.length) {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        return { average: Math.round(avg * 10) / 10, count: scores.length, source: "supabase" };
      }
    } catch {
      /* fall through */
    }
  }

  if (!scores.length) return { average: null, count: 0, source: "empty" };
  const unique = [...new Set(scores)];
  const avg = unique.reduce((a, b) => a + b, 0) / unique.length;
  return { average: Math.round(avg * 10) / 10, count: unique.length, source: "local" };
}
