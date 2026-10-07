import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { Lang, SegmentOut, Term } from '@/shared/api/generated'
import { GlossaryService, NO_FILTERS } from '../api/GlossaryService'
import { isEntryStatus } from '../constants'
import { EMPTY } from '../lib/entry'
import { EntryForm } from './EntryForm'
import { shownTarget } from '../lib/chunkify'
import { useMutation } from '@/shared/api/base'
import { TextField } from '@/shared/components/form'
import { Btn, ErrorText, Modal } from '@/shared/components/ui'

interface Props {
  term: Term
  seg: SegmentOut
  lang: string
  src: string
  /**
   * Replaces `old` (whole words) by `value` in this segment or the whole project, together with the term's stored
   * translation (the project page knows how). Resolves to the number of segments changed.
   */
  onReplace: (old: string, value: string, segmentOnly: boolean) => Promise<number>
  editable: boolean
  onClose: () => void
  onChanged: () => void
}

export const TermDialog = ({ term, seg, lang, src, editable, onClose, onReplace, onChanged }: Props) => {
  const { t } = useTranslation(['glossary', 'common'])
  // what the translation really says, which an earlier edit may have changed ("steelll" for "steel")
  const shown = shownTarget(seg.translations[lang]?.text ?? '', term.target)
  const [value, setValue] = useState(shown)
  const [adding, setAdding] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const { data: entries = [] } = GlossaryService.useFetchEntries(NO_FILTERS, term.glossary_id === null)
  const entry = entries.find((e) => e.id === term.glossary_id)
  const replace = useMutation(
    ({ next, segmentOnly }: { next: string; segmentOnly: boolean }) => onReplace(shown, next, segmentOnly),
    {
      onSuccess: (count) => {
        setNotFound(count === 0)
        if (count === 0) return
        onChanged()
        onClose()
      },
    },
  )
  const changed = value.trim() !== '' && value !== shown
  const canAdd = editable && term.category !== 'glossary' && term.category !== 'protected'
  const initial = { ...EMPTY, [src]: term.source, [lang]: term.target }

  return (
    <Modal title={t('term.title', { term: term.source })} onClose={onClose}>
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-xs uppercase text-stone-600">{t('term.category')}</dt>
          <dd>
            {t(`common:category.${term.category}`)}
            {!term.ok && <span className="ml-2 text-red-600">{t('term.missing')}</span>}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-stone-600">
            {t('term.usedTranslation', { lang: t(`common:lang.${lang as Lang}`) })}
          </dt>
          <dd className="font-medium">{term.dnt ? t('term.doNotTranslate', { target: shown }) : shown || '—'}</dd>
        </div>
        {term.description && (
          <div>
            <dt className="text-xs uppercase text-stone-600">{t('term.description')}</dt>
            <dd>{term.description}</dd>
          </div>
        )}
        {term.alternatives.length > 0 && (
          <div>
            <dt className="text-xs uppercase text-stone-600">{t('term.alternatives')}</dt>
            <dd className="mt-1 flex flex-wrap gap-2">
              {term.alternatives.map((a) => (
                <Btn
                  key={a}
                  disabled={!editable || replace.isPending}
                  onClick={() => {
                    replace.mutate({ next: a, segmentOnly: true })
                  }}
                >
                  {a}
                </Btn>
              ))}
            </dd>
          </div>
        )}
        {entry && (
          <div>
            <dt className="text-xs uppercase text-stone-600">{t('term.entry')}</dt>
            <dd>
              {Object.values(entry.terms).join(' → ')} · v{entry.version} ·{' '}
              {isEntryStatus(entry.status) ? t(`status.${entry.status}`) : entry.status}{' '}
              <Link to="/glossary" className="text-blue-700 underline">
                {t('term.openInGlossary')}
              </Link>
            </dd>
          </div>
        )}
      </dl>
      {editable && (
        <div className="mt-4 space-y-2 border-t pt-4">
          <p className="text-xs uppercase text-stone-600">{t('term.editDirectly')}</p>
          <TextField hideLabel label={t('term.newTranslation')} value={value} onChange={setValue} />
          <div className="flex flex-wrap gap-2">
            <Btn
              disabled={!changed || replace.isPending}
              onClick={() => {
                replace.mutate({ next: value, segmentOnly: true })
              }}
            >
              {t('term.replaceInSegment')}
            </Btn>
            <Btn
              disabled={!changed || replace.isPending}
              onClick={() => {
                replace.mutate({ next: value, segmentOnly: false })
              }}
            >
              {t('term.replaceInProject')}
            </Btn>
            {canAdd && (
              <Btn
                variant="primary"
                onClick={() => {
                  setAdding(!adding)
                }}
              >
                {t('term.addToGlossary')}
              </Btn>
            )}
          </div>
          <ErrorText error={replace.error} />
          {notFound && <p className="text-sm text-red-700">{t('term.notFound', { term: shown })}</p>}
        </div>
      )}
      {adding && (
        <div className="mt-4 border-t pt-4">
          <EntryForm
            initial={{ ...initial, [lang]: value }}
            onDone={() => {
              setAdding(false)
              onChanged()
              onClose()
            }}
          />
        </div>
      )}
    </Modal>
  )
}
