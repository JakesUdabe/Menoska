"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { messages } from "@/i18n";
import { isLocale, type Locale } from "@/i18n/locales";
import type { Messages } from "@/i18n/types";

type LocaleValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  copy: Messages;
};

const LocaleContext = createContext<LocaleValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("es");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("lang");
    const stored = window.localStorage.getItem("menoska-lang");
    const initial = isLocale(fromUrl) ? fromUrl : isLocale(stored) ? stored : "es";
    setLocaleState(initial);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem("menoska-lang", locale);
    document.querySelector('meta[name="description"]')?.setAttribute("content", messages[locale].metaDescription);
  }, [locale]);

  function setLocale(next: Locale) {
    setLocaleState(next);
    const url = new URL(window.location.href);
    if (next === "es") url.searchParams.delete("lang");
    else url.searchParams.set("lang", next);
    window.history.replaceState(null, "", url);
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale, copy: messages[locale] }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale debe usarse dentro de LocaleProvider");
  return value;
}
