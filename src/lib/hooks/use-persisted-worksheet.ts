"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useAuth } from "@/components/auth-provider";
import { loadWorksheet, persistWorksheet } from "@/lib/worksheets-repository";

const DEFAULT_DEBOUNCE_MS = 400;

/**
 * Load calculator state from localStorage (and mc_worksheets when configured) on mount;
 * debounce-persist on change.
 */
export function usePersistedWorksheet<T>(
  toolId: string,
  initial: T,
  debounceMs = DEFAULT_DEBOUNCE_MS,
): [T, Dispatch<SetStateAction<T>>] {
  const { user } = useAuth();
  const [state, setState] = useState<T>(initial);
  const hydrated = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userId = user?.id ?? null;
  const organizationId = user?.organizationId ?? null;

  useEffect(() => {
    let cancelled = false;
    hydrated.current = false;
    void (async () => {
      const saved = await loadWorksheet<T>(toolId, { userId });
      if (cancelled) return;
      if (saved !== null) setState(saved);
      hydrated.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [toolId, userId]);

  useEffect(() => {
    if (!hydrated.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void persistWorksheet(toolId, state, { userId, organizationId });
    }, debounceMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [toolId, state, debounceMs, userId, organizationId]);

  return [state, setState];
}
