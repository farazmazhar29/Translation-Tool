import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { Highlighted } from '@/features/glossary'
import type { Term } from '@/shared/api/generated'
import type { Segment } from '../types'

/** A line without sentence punctuation and without numbers at the start is a title or heading. */
const isHeading = (text: string): boolean =>
  text.split(/\s+/).length <= 7 && !/[.,:;!?]/.test(text) && !/^\d/.test(text.trim())

interface Props {
  segments: readonly Segment[]
  lang: string
  srcLang: string
  onTerm: (seg: Segment, term: Term) => void
}

/**
 * The document as a reader sees it: the original and the translation as two pages next to each other, titles and
 * paragraphs in running text, the terms highlighted. Every paragraph stays level with its translation.
 */
export const PageView = ({ segments, lang, srcLang, onTerm }: Props) => {
  const { t } = useTranslation('projects')
  const last = segments.length - 1
  const sheet = (i: number): string =>
    `lg:border-x lg:border-line lg:bg-white lg:px-14 ${i === 0 ? 'lg:rounded-t-2xl lg:border-t lg:pt-12' : ''} ${i === last ? 'lg:rounded-b-2xl lg:border-b lg:pb-12' : ''}`
  return (
    <div className="grid gap-x-8 lg:grid-cols-2 [&>*]:min-w-0">
      <p className="mb-3 hidden text-[11px] font-bold uppercase tracking-wider text-stone-600 lg:block">
        {t('view.columnOriginal', { lang: srcLang.toUpperCase() || '?' })}
      </p>
      <p className="mb-3 hidden text-[11px] font-bold uppercase tracking-wider text-stone-600 lg:block">
        {t('view.columnTranslation', { lang: lang.toUpperCase() })}
      </p>
      {segments.map((seg, i) => {
        const tr = seg.translations[lang]
        const terms = tr?.terms ?? []
        const title = i === 0
        const heading = !title && isHeading(seg.source_text)
        const text = title
          ? 'text-2xl font-bold leading-snug'
          : heading
            ? 'mt-3 text-lg font-bold leading-snug'
            : 'text-[15px] leading-7'
        return (
          <Fragment key={seg.id}>
            <div
              id={`seg-${seg.idx}`}
              className={`rounded-xl bg-white px-6 py-2 lg:rounded-none lg:py-1.5 ${sheet(i)}`}
            >
              <Highlighted
                text={seg.source_text}
                terms={terms}
                side="source"
                className={text}
                onTerm={(term) => {
                  onTerm(seg, term)
                }}
              />
            </div>
            <div
              className={`mb-4 rounded-xl border-l-4 border-brand/40 bg-stone-50 px-6 py-2 lg:mb-0 lg:rounded-none lg:border-l-0 lg:py-1.5 ${sheet(i)}`}
            >
              {tr ? (
                <Highlighted
                  text={tr.text}
                  terms={terms}
                  side="target"
                  className={text}
                  onTerm={(term) => {
                    onTerm(seg, term)
                  }}
                />
              ) : (
                <p className="text-sm italic text-stone-600">{t('row.notTranslated')}</p>
              )}
            </div>
          </Fragment>
        )
      })}
    </div>
  )
}
