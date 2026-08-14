import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import he from "./locales/he.json";

export const RTL_LANGUAGES = new Set(["he"]);

// Hebrew (RTL) is the default UI language per PRD section 7 (NFR:
// Internationalization); English is the other supported language.
const STORAGE_KEY = "bohan-peta-lang";
const initialLang = localStorage.getItem(STORAGE_KEY) ?? "he";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    he: { translation: he },
  },
  lng: initialLang,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export function setLanguage(lang: "en" | "he") {
  localStorage.setItem(STORAGE_KEY, lang);
  i18n.changeLanguage(lang);
  applyDocumentDirection(lang);
}

export function applyDocumentDirection(lang: string) {
  document.documentElement.lang = lang;
  document.documentElement.dir = RTL_LANGUAGES.has(lang) ? "rtl" : "ltr";
}

applyDocumentDirection(initialLang);

export default i18n;
