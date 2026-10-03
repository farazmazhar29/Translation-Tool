import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Highlighted } from '@/features/glossary'
import type { S } from '@/shared/api/client'
import { TextArea } from '@/shared/components/form'
import { Btn } from '@/shared/components/ui'
import type { Segment } from '../types'

interface Props {
  seg: Segment
  lang: string
  editable: boolean
  onTerm: (seg: Segment, t: S['Term']) => void
  onSave: (seg: Segment, body: S['SegmentEdit']) => void
  onRegenerate: (seg: Segment) => void
  busy: boolean
}

export const SegmentRow = ({ seg, lang, editable, onTerm, onSave, onRegenerate, busy }: Props) => {
  const { t } = useTranslation(['projects', 'common'])
  const tr = seg.translations[lang]
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? tr?.text ?? ''
  const [showComment, setShowComment] = useState(!!tr?.comment)
  const [comment, setComment] = useState(tr?.comment ?? '')
  const terms = tr?.terms ?? []
  const missing = terms.some((term) => !term.ok)
  return (
    <div id={`seg-${seg.idx}`} className={`grid gap-3 border-b p-3 md:grid-cols-2 ${missing ? 'bg-red-50/40' : ''}`}>
      <div>
        <span className="mb-1 block text-xs text-slate-600">#{seg.idx + 1}</span>
        <Highlighted
          text={seg.source_text}
          terms={terms}
          side="source"
          onTerm={(term) => {
            onTerm(seg, term)
          }}
        />
      </div>
      <div>
        <span className="mb-1 block text-xs font-semibold uppercase text-slate-600 md:hidden">
          {t('row.translation')}
        </span>
        <div className="mb-1 flex items-center gap-2 text-xs text-slate-600">
          {tr?.edited && (
            <span className="rounded bg-amber-100 px-1.5 text-amber-800">
              {t('row.editedBy', { name: tr.edited_by })}
            </span>
          )}
          {editable && tr && (
            <span className="ml-auto flex gap-1">
              <button
                type="button"
                className="hover:text-red-700"
                onClick={() => {
                  setEditing(!editing)
                }}
              >
                {t('row.edit')}
              </button>
              <button
                type="button"
                className="hover:text-red-700"
                disabled={busy}
                onClick={() => {
                  onRegenerate(seg)
                }}
              >
                {t('row.regenerate')}
              </button>
              <button
                type="button"
                className="hover:text-red-700"
                onClick={() => {
                  setShowComment(!showComment)
                }}
              >
                {t('row.comment')}
              </button>
            </span>
          )}
        </div>
        {!tr && <p className="text-sm italic text-slate-600">{t('row.notTranslated')}</p>}
        {tr && editing ? (
          <div className="space-y-2">
            <TextArea
              hideLabel
              label={t('row.editTranslation')}
              rows={Math.max(2, Math.ceil(text.length / 60))}
              value={text}
              onChange={setDraft}
            />
            <div className="flex gap-2">
              <Btn
                variant="primary"
                onClick={() => {
                  onSave(seg, { text })
                  setDraft(null)
                  setEditing(false)
                }}
              >
                {t('row.apply')}
              </Btn>
              <Btn
                onClick={() => {
                  setDraft(null)
                  setEditing(false)
                }}
              >
                {t('common:cancel')}
              </Btn>
            </div>
          </div>
        ) : (
          tr && (
            <Highlighted
              text={tr.text}
              terms={terms}
              side="target"
              onTerm={(term) => {
                onTerm(seg, term)
              }}
            />
          )
        )}
        {showComment && tr && (
          <TextArea
            hideLabel
            label={t('row.commentLabel')}
            className="mt-2"
            rows={2}
            placeholder={t('row.commentPlaceholder')}
            disabled={!editable}
            value={comment}
            onChange={setComment}
            onBlur={() => {
              if (comment !== tr.comment) onSave(seg, { comment })
            }}
          />
        )}
      </div>
    </div>
  )
}
