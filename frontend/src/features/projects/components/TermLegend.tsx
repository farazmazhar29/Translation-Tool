import { useTranslation } from 'react-i18next'
import { TERM_CATEGORIES } from '@/shared/constants'
import { SettingsService } from '@/shared/api/services/SettingsService'

/** Colour key of the highlighted term categories (the colours are configurable in the settings). */
export const TermLegend = () => {
  const { t } = useTranslation('common')
  const colors = SettingsService.useFetchSettings().data?.colors
  return (
    <ul className="flex flex-wrap gap-2 text-xs">
      {TERM_CATEGORIES.map((k) => (
        <li
          key={k}
          className="flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 font-medium"
        >
          <span className="size-2.5 rounded-full" style={{ background: colors?.[k] ?? '#999999' }} aria-hidden="true" />
          {t(`category.${k}`)}
        </li>
      ))}
    </ul>
  )
}
