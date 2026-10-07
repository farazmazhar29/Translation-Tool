import { FileSearch } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card } from '@/shared/components/ui'
import type { Segment } from '../types'

const SHOWN = 15 // enough to check that the file was read correctly; the translation covers all of it

/** The text that was found in the uploaded file, before it is translated: one row per segment. */
export const SourcePreview = ({ segments }: { segments: readonly Segment[] }) => {
  const { t } = useTranslation('projects')
  return (
    <Card>
      <div className="mb-5 flex items-start gap-4">
        <span
          className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"
          aria-hidden="true"
        >
          <FileSearch className="size-5" />
        </span>
        <div>
          <h2 className="text-base font-bold">{t('preview.title')}</h2>
          <p className="mt-0.5 text-sm text-stone-600">{t('view.analyzed')}</p>
        </div>
      </div>
      <ol className="divide-y divide-line rounded-xl border border-line">
        {segments.slice(0, SHOWN).map((segment) => (
          <li key={segment.id} className="flex gap-4 px-4 py-3">
            <span className="mt-0.5 h-fit w-11 shrink-0 rounded-full bg-stone-100 py-0.5 text-center text-xs font-bold text-stone-600">
              #{segment.idx + 1}
            </span>
            <span className="min-w-0 text-[15px] leading-relaxed">{segment.source_text}</span>
          </li>
        ))}
      </ol>
      {segments.length > SHOWN && (
        <p className="mt-3 text-sm text-stone-600">{t('preview.more', { count: segments.length - SHOWN })}</p>
      )}
    </Card>
  )
}
