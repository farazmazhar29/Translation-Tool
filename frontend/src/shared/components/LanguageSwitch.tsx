import { useTranslation } from 'react-i18next'
import { LANGUAGES } from '../i18n'

/** DE / EN toggle for the interface language (the choice is remembered in the browser). */
export const LanguageSwitch = () => {
  const { t, i18n } = useTranslation()
  return (
    <div
      role="group"
      aria-label={t('language')}
      className="flex overflow-hidden rounded-md border border-slate-300 text-xs"
    >
      {LANGUAGES.map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-pressed={i18n.resolvedLanguage === code}
          className={`px-2 py-1 font-medium ${i18n.resolvedLanguage === code ? 'bg-red-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
          onClick={() => {
            void i18n.changeLanguage(code)
          }}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
