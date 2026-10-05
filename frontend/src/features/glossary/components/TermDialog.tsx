import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { get, post, type Lang, type S } from '@/shared/api/client'
import { isEntryStatus } from '../constants'
import { EMPTY } from '../lib/entry'
import { EntryForm } from './EntryForm'
import { replaceFirst } from '../lib/text'
import { useAction } from '@/shared/lib/hooks'
import { TextField } from '@/shared/components/form'
import { Btn, ErrorText, Modal } from '@/shared/components/ui'

interface Props {
  term: S['Term']
  seg: S['SegmentOut']
  lang: string
  src: string
  projectId: number
  editable: boolean
  onClose: () => void
  onSegmentText: (text: string) => void
  onChanged: () => void
}

export const TermDialog = ({ term, seg, lang, src, projectId, editable, onClose, onSegmentText, onChanged }: Props) => {
  const { t } = useTranslation(['glossary', 'common'])
  const text = seg.translations[lang]?.text ?? ''
  const [value, setValue] = useState(term.target)
  const [adding, setAdding] = useState(false)
  const { data: entries = [] } = useQuery({
    queryKey: ['glossary', { q: '', status: '', category: '' }],
    queryFn: () => get<S['GlossaryOut'][]>('/glossary'),
    enabled: term.glossary_id !== null && term.glossary_id !== undefined,
  })
  const entry = entries.find((e) => e.id === term.glossary_id)
  const everywhere = useAction(
    () => post(`/projects/${projectId}/replace-term`, { lang, old: term.target, new: value }),
    {
      onSuccess: () => {
        onChanged()
        onClose()
      },
    },
  )
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
