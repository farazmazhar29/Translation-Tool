import { useTranslation } from 'react-i18next'
import { LANGUAGES } from '../i18n'

/** DE / EN toggle for the interface language (the choice is remembered in the browser). */
export const LanguageSwitch = () => {
  const { t, i18n } = useTranslation()
  return (
    <div role="group" aria-label={t('language')} className="flex w-fit rounded-full bg-stone-100 p-1 text-xs">
      {LANGUAGES.map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-pressed={i18n.resolvedLanguage === code}
          className={`rounded-full px-3 py-1 font-semibold transition ${i18n.resolvedLanguage === code ? 'bg-white text-ink shadow-sm' : 'text-stone-600 hover:text-ink'}`}
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
