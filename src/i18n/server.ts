import { flattenMessages, getMessages } from "./messages";
import type { Locale } from "./locales";

export function createTranslator(locale: Locale) {
  const dict = flattenMessages(getMessages(locale));
  return (key: string) => dict[key] ?? key;
}
