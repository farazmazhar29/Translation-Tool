import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

export const LANGUAGES = ['de', 'en'] as const
type Language = (typeof LANGUAGES)[number]

/** Same keys as `T`, every text a string: the English file is checked against the German one. */
export type Texts<T> = { [K in keyof T]: T[K] extends string ? string : Texts<T[K]> }

/** One bundle per language; each bundle maps a namespace (`common`, one per feature) to its texts. */
type Resources = Record<Language, Record<string, object>>

/**
 * Sets up i18next: the language comes from the user's last choice, else from the browser; anything we do not
 * have falls back to English. `<html lang>` follows the active language.
 */
export const setupI18n = (resources: Resources): void => {
  i18n.on('languageChanged', (lng) => {
    document.documentElement.lang = lng
  })
  void i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      fallbackLng: 'en',
      supportedLngs: LANGUAGES,
      load: 'languageOnly',
      defaultNS: 'common',
      interpolation: { escapeValue: false }, // React already escapes
      detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'] },
    })
}
