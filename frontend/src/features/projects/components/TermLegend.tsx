import { useTranslation } from 'react-i18next'
import { TERM_CATEGORIES } from '@/shared/constants'
import { useSettings } from '@/shared/lib/ui'

/** Colour key of the highlighted term categories (the colours are configurable in the settings). */
export const TermLegend = () => {
  const { t } = useTranslation('common')
  const colors = useSettings()?.colors
  return (
    <div className="flex flex-wrap gap-3 text-xs">
      {TERM_CATEGORIES.map((k) => (
        <span key={k} className="flex items-center gap-1">
          <span
            className="inline-block h-3 w-3 rounded"
            style={{ background: `${colors?.[k] ?? '#999'}55`, borderBottom: `2px solid ${colors?.[k] ?? '#999'}` }}
          />{' '}
          {t(`category.${k}`)}
        </span>
      ))}
    </div>
  )
}
