export const COOKIE_CONSENT_KEY = "abi_cookie_consent";
export const COOKIE_CONSENT_EVENT = "abi-cookie-consent";

export type CookiePreferences = {
  essential: true;
  analytics: boolean;
  updatedAt: string;
};

export function readCookiePrefs(): CookiePreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CookiePreferences;
    if (parsed?.essential === true) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

export function writeCookiePrefs(analytics: boolean): CookiePreferences {
  const prefs: CookiePreferences = {
    essential: true,
    analytics,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(prefs));
  window.dispatchEvent(new Event(COOKIE_CONSENT_EVENT));
  return prefs;
}
