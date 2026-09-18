export const LOCALES = ["es", "ca", "eu", "gl", "va", "en", "fr", "de", "it", "pt", "zh", "ja"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "es";

export const LOCALE_LABELS: Record<Locale, string> = {
  es: "Español",
  ca: "Català",
  eu: "Euskara",
  gl: "Galego",
  va: "Valencià",
  en: "English",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  pt: "Português",
  zh: "中文",
  ja: "日本語",
};

export const LOCALE_COOKIE = "abi_locale";
export const LOCALE_STORAGE_KEY = "abi_locale";

export function isLocale(value: string | null | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}

export function negotiateLocale(input?: string | null): Locale {
  if (!input) return DEFAULT_LOCALE;
  const lower = input.toLowerCase();
  if (isLocale(lower)) return lower;
  const short = lower.slice(0, 2);
  if (isLocale(short)) return short;
  if (lower.startsWith("ca-valencia") || lower.startsWith("val")) return "va";
  if (lower.startsWith("zh")) return "zh";
  return DEFAULT_LOCALE;
}
