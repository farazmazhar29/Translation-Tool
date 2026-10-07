import { useTranslation } from 'react-i18next'
import type { SegmentEdit, Term } from '@/shared/api/generated'
import { Card } from '@/shared/components/ui'
import type { Segment } from '../types'
import { SegmentRow } from './SegmentRow'

interface Props {
  segments: readonly Segment[]
  lang: string
  srcLang: string
  editable: boolean
  busy: boolean
  onTerm: (seg: Segment, term: Term) => void
  onSave: (seg: Segment, body: SegmentEdit) => void
  onRegenerate: (seg: Segment) => void
}

/** Original and translation side by side, one row per segment. */
export const SegmentTable = ({ segments, lang, srcLang, ...row }: Props) => {
  const { t } = useTranslation('projects')
  return (
    <Card flush>
      <div className="grid border-b border-line bg-stone-50 text-[11px] font-bold uppercase tracking-wider text-stone-600 lg:grid-cols-2">
        <span className="px-6 py-3.5">{t('view.columnOriginal', { lang: srcLang.toUpperCase() || '?' })}</span>
        <span className="hidden px-6 py-3.5 lg:block lg:pl-0">
          {t('view.columnTranslation', { lang: lang.toUpperCase() })}
        </span>
      </div>
      {segments.map((seg) => (
        <SegmentRow key={seg.id} seg={seg} lang={lang} {...row} />
      ))}
    </Card>
  )
}
