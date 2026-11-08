/** Migrate localStorage from legacy abi_* keys to menoska_* once. */
export function readMigratedStorage(newKey: string, oldKey: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const existing = localStorage.getItem(newKey);
    if (existing !== null) return existing;
    const legacy = localStorage.getItem(oldKey);
    if (legacy !== null) {
      localStorage.setItem(newKey, legacy);
      return legacy;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string) {
  localStorage.setItem(key, value);
}
