import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CATEGORIES, LANGS, get, post, type Lang, type S } from '../api/client'
import { EMPTY } from '../lib/entry'
import { EntryForm } from './EntryForm'
import { replaceFirst } from '../lib/text'
import { input } from '../lib/ui'
import { Btn, ErrorText, Modal } from './ui'

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

export function TermDialog({ term, seg, lang, src, projectId, editable, onClose, onSegmentText, onChanged }: Props) {
  const text = seg.translations[lang]?.text ?? ''
  const [value, setValue] = useState(term.target)
  const [adding, setAdding] = useState(false)
  const { data: entries = [] } = useQuery({
    queryKey: ['glossary', { q: '', status: '', category: '' }],
    queryFn: () => get<S['GlossaryOut'][]>('/glossary'),
    enabled: term.glossary_id !== null && term.glossary_id !== undefined,
  })
  const entry = entries.find((e) => e.id === term.glossary_id)
  const everywhere = useMutation({
    mutationFn: () => post(`/projects/${projectId}/replace-term`, { lang, old: term.target, new: value }),
    onSuccess: () => {
      onChanged()
      onClose()
    },
  })
  const changed = value.trim() !== '' && value !== term.target
  const canAdd = editable && term.category !== 'glossary' && term.category !== 'protected'
  const initial = { ...EMPTY, [src]: term.source, [lang]: term.target }

  return (
    <Modal title={`„${term.source}“`} onClose={onClose}>
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-xs uppercase text-slate-600">Kategorie</dt>
          <dd>
            {CATEGORIES[term.category]}
            {!term.ok && <span className="ml-2 text-red-600">⚠ Begriff fehlt in der Übersetzung</span>}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-slate-600">Verwendete Übersetzung ({LANGS[lang as Lang]})</dt>
          <dd className="font-medium">{term.dnt ? `${term.target} (nicht übersetzen)` : term.target || '—'}</dd>
        </div>
        {term.description && (
          <div>
            <dt className="text-xs uppercase text-slate-600">Beschreibung</dt>
            <dd>{term.description}</dd>
          </div>
        )}
        {term.alternatives.length > 0 && (
          <div>
            <dt className="text-xs uppercase text-slate-600">Alternative Übersetzungen</dt>
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
            <dt className="text-xs uppercase text-slate-600">Glossareintrag</dt>
            <dd>
              {Object.values(entry.terms).join(' → ')} · v{entry.version} · {entry.status}{' '}
              <Link to="/glossary" className="text-blue-700 underline">
                im Glossar öffnen
              </Link>
            </dd>
          </div>
        )}
      </dl>
      {editable && (
        <div className="mt-4 space-y-2 border-t pt-4">
          <p className="text-xs uppercase text-slate-600">Direkt bearbeiten</p>
          <input
            aria-label="Neue Übersetzung"
            className={input}
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Btn
              disabled={!changed}
              onClick={() => {
                onSegmentText(replaceFirst(text, term.target, value))
                onClose()
              }}
            >
              Nur in diesem Segment ersetzen
            </Btn>
            <Btn
              disabled={!changed || everywhere.isPending}
              onClick={() => {
                everywhere.mutate()
              }}
            >
              Im ganzen Projekt ersetzen
            </Btn>
            {canAdd && (
              <Btn
                variant="primary"
                onClick={() => {
                  setAdding(!adding)
                }}
              >
                Ins Glossar übernehmen
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
