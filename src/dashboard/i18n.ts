"use client";

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ca from "@/i18n/catalogs/ca.json";
import en from "@/i18n/catalogs/en.json";
import es from "@/i18n/catalogs/es.json";
import eu from "@/i18n/catalogs/eu.json";
import gl from "@/i18n/catalogs/gl.json";

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: {
      es: { translation: es },
      en: { translation: en },
      eu: { translation: eu },
      ca: { translation: ca },
      gl: { translation: gl },
    },
    lng: "es",
    fallbackLng: "es",
    interpolation: { escapeValue: false },
  });
}

export default i18n;
