import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { Lang, SegmentOut, Term } from '@/shared/api/generated'
import { GlossaryService, NO_FILTERS } from '../api/GlossaryService'
import { isEntryStatus } from '../constants'
import { EMPTY } from '../lib/entry'
import { EntryForm } from './EntryForm'
import { replaceFirst } from '../lib/text'
import { useMutation } from '@/shared/api/base'
import { TextField } from '@/shared/components/form'
import { Btn, ErrorText, Modal } from '@/shared/components/ui'

interface Props {
  term: Term
  seg: SegmentOut
  lang: string
  src: string
  /** Replaces the term's translation in every segment of the project (the project page knows how). */
  onReplaceEverywhere: (old: string, value: string) => Promise<unknown>
  editable: boolean
  onClose: () => void
  onSegmentText: (text: string) => void
  onChanged: () => void
}

export const TermDialog = ({
  term,
  seg,
  lang,
  src,
  editable,
  onClose,
  onSegmentText,
  onReplaceEverywhere,
  onChanged,
}: Props) => {
  const { t } = useTranslation(['glossary', 'common'])
  const text = seg.translations[lang]?.text ?? ''
  const [value, setValue] = useState(term.target)
  const [adding, setAdding] = useState(false)
  const { data: entries = [] } = GlossaryService.useFetchEntries(NO_FILTERS, term.glossary_id === null)
  const entry = entries.find((e) => e.id === term.glossary_id)
  const everywhere = useMutation(() => onReplaceEverywhere(term.target, value), {
    onSuccess: () => {
      onChanged()
      onClose()
    },
  })
  const changed = value.trim() !== '' && value !== term.target
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
          <dd className="font-medium">
            {term.dnt ? t('term.doNotTranslate', { target: term.target }) : term.target || '—'}
          </dd>
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
                  disabled={!editable}
                  onClick={() => {
                    onSegmentText(replaceFirst(text, term.target, a))
                    onClose()
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
              disabled={!changed}
              onClick={() => {
                onSegmentText(replaceFirst(text, term.target, value))
                onClose()
              }}
            >
              {t('term.replaceInSegment')}
            </Btn>
            <Btn
              disabled={!changed || everywhere.isPending}
              onClick={() => {
                everywhere.mutate()
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
          <ErrorText error={everywhere.error} />
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
