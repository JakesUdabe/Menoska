export const locales = ["es", "en", "eu", "ca", "gl"] as const;

export type Locale = (typeof locales)[number];

export function isLocale(value: string | null | undefined): value is Locale {
  return Boolean(value && locales.includes(value as Locale));
}

export const localeLabels: Record<Locale, string> = {
  es: "Español",
  en: "English",
  eu: "Euskara",
  ca: "Català",
  gl: "Galego",
};
