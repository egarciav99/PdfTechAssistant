import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import es from './locales/es.json';

export const LANGUAGES = ['es', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

/** Idioma activo normalizado ('es-MX' → 'es'). */
export const currentLanguage = (): Language => (i18n.resolvedLanguage === 'en' ? 'en' : 'es');

export function initI18n(defaultLanguage: Language = 'es') {
  if (i18n.isInitialized) return i18n;
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        en: { translation: en },
        es: { translation: es },
      },
      supportedLngs: LANGUAGES as unknown as string[],
      nonExplicitSupportedLngs: true,
      fallbackLng: defaultLanguage,
      detection: {
        order: ['localStorage', 'navigator'],
        lookupLocalStorage: 'pdftechassistant.lang',
        caches: ['localStorage'],
      },
      interpolation: {
        escapeValue: false,
      },
    });
  const syncHtmlLang = () => document.documentElement.setAttribute('lang', currentLanguage());
  syncHtmlLang();
  i18n.on('languageChanged', syncHtmlLang);
  return i18n;
}

export default i18n;
