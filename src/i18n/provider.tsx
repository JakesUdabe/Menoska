"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import i18n from "i18next";
import { I18nextProvider, initReactI18next, useTranslation } from "react-i18next";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, LOCALE_STORAGE_KEY, type Locale } from "./locales";
import { getMessages } from "./messages";

let i18nReady = false;

function ensureI18n(locale: Locale) {
  if (!i18nReady) {
    void i18n.use(initReactI18next).init({
      lng: locale,
      fallbackLng: DEFAULT_LOCALE,
      interpolation: { escapeValue: false },
      resources: {
        [locale]: { translation: getMessages(locale) },
      },
      keySeparator: ".",
      nsSeparator: false,
    });
    i18nReady = true;
  } else if (i18n.language !== locale) {
    if (!i18n.hasResourceBundle(locale, "translation")) {
      i18n.addResourceBundle(locale, "translation", getMessages(locale), true, true);
    }
    void i18n.changeLanguage(locale);
  }
}

type I18nContextValue = {
  locale: Locale;
  setLocale: (next: Locale, persistProfile?: boolean) => void;
};

const LocaleContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
});

export function AppI18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  ensureI18n(locale);
  const [current, setCurrent] = useState<Locale>(locale);

  useEffect(() => {
    ensureI18n(locale);
    setCurrent(locale);
    document.documentElement.lang = locale === "va" ? "ca-valencia" : locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    if (!isLocale(next)) return;
    ensureI18n(next);
    setCurrent(next);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  const value = useMemo(() => ({ locale: current, setLocale }), [current, setLocale]);

  return (
    <LocaleContext.Provider value={value}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}

export function useT() {
  const { t } = useTranslation();
  return t;
}
