import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import fr from "@/locales/fr.json";
import ar from "@/locales/ar.json";
import en from "@/locales/en.json";

export const SUPPORTED_LANGS = ["fr", "ar", "en"] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];
export const RTL_LANGS: Lang[] = ["ar"];

if (!i18n.isInitialized) {
  void i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        fr: { translation: fr },
        ar: { translation: ar },
        en: { translation: en },
      },
      fallbackLng: "fr",
      supportedLngs: SUPPORTED_LANGS as unknown as string[],
      interpolation: { escapeValue: false },
      detection: {
        order: ["localStorage", "navigator"],
        caches: ["localStorage"],
        lookupLocalStorage: "agriplan.lang",
      },
    });
}

export function applyDirection(lang: string) {
  if (typeof document === "undefined") return;
  const isRtl = RTL_LANGS.includes(lang as Lang);
  document.documentElement.dir = isRtl ? "rtl" : "ltr";
  document.documentElement.lang = lang;
}

export default i18n;