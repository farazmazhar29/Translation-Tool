import { MessageSquare, Pencil, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Highlighted } from '@/features/glossary'
import type { SegmentEdit, Term } from '@/shared/api/generated'
import { TextArea } from '@/shared/components/form'
import { Btn } from '@/shared/components/ui'
import type { Segment } from '../types'

interface Props {
  seg: Segment
  lang: string
  editable: boolean
  onTerm: (seg: Segment, t: Term) => void
  onSave: (seg: Segment, body: SegmentEdit) => void
  onRegenerate: (seg: Segment) => void
  busy: boolean
}

const action =
  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-stone-600 transition hover:bg-stone-100 hover:text-ink disabled:opacity-50'

export const SegmentRow = ({ seg, lang, editable, onTerm, onSave, onRegenerate, busy }: Props) => {
  const { t } = useTranslation(['projects', 'common'])
  const tr = seg.translations[lang]
  const [draft, setDraft] = useState<string | null>(null) // the text being edited; null while not editing
  const [showComment, setShowComment] = useState(!!tr?.comment)
  const [comment, setComment] = useState(tr?.comment ?? '')
  const terms = tr?.terms ?? []
  const missing = terms.some((term) => !term.ok)
  return (
    <div
      id={`seg-${seg.idx}`}
      className={`grid gap-5 border-b border-line px-6 py-5 last:border-b-0 lg:grid-cols-2 lg:gap-8 ${missing ? 'bg-red-50/50' : 'hover:bg-stone-50/60'}`}
    >
      <div>
        <div className="mb-2 flex min-h-7 items-center">
          <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-bold text-stone-600">
            #{seg.idx + 1}
          </span>
        </div>
        <div className="text-[15px] leading-relaxed">
          <Highlighted
            text={seg.source_text}
            terms={terms}
            side="source"
            className="text-[15px] leading-relaxed"
            onTerm={(term) => {
              onTerm(seg, term)
            }}
          />
        </div>
      </div>
      <div>
        <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-600 lg:hidden">
          {t('row.translation')}
        </span>
        <div className="mb-2 flex min-h-7 items-center gap-2">
          {tr?.edited && (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
              {t('row.editedBy', { name: tr.edited_by })}
            </span>
          )}
          {editable && tr && (
            <span className="ml-auto flex gap-1">
              <button
                type="button"
                className={action}
                onClick={() => {
                  setDraft(draft === null ? tr.text : null)
                }}
              >
                <Pencil className="size-3.5" aria-hidden="true" />
                {t('row.edit')}
              </button>
              <button
                type="button"
                className={action}
                disabled={busy}
                onClick={() => {
                  onRegenerate(seg)
                }}
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                {t('row.regenerate')}
              </button>
              <button
                type="button"
                className={action}
                onClick={() => {
                  setShowComment(!showComment)
                }}
              >
                <MessageSquare className="size-3.5" aria-hidden="true" />
                {t('row.comment')}
              </button>
            </span>
          )}
        </div>
        {!tr && <p className="text-sm italic text-stone-600">{t('row.notTranslated')}</p>}
        {tr && draft !== null ? (
          <div className="space-y-3">
            <TextArea
              hideLabel
              label={t('row.editTranslation')}
              rows={Math.max(2, Math.ceil(draft.length / 60))}
              value={draft}
              onChange={setDraft}
            />
            <div className="flex gap-2">
              <Btn
                variant="primary"
                className="!px-4 !py-1.5"
                onClick={() => {
                  onSave(seg, { text: draft })
                  setDraft(null)
                }}
              >
                {t('row.apply')}
              </Btn>
              <Btn
                className="!px-4 !py-1.5"
                onClick={() => {
                  setDraft(null)
                }}
              >
                {t('common:cancel')}
              </Btn>
            </div>
          </div>
        ) : (
          tr && (
            <div className="text-[15px] leading-relaxed">
              <Highlighted
                text={tr.text}
                terms={terms}
                side="target"
                className="text-[15px] leading-relaxed"
                onTerm={(term) => {
                  onTerm(seg, term)
                }}
              />
            </div>
          )
        )}
        {showComment && tr && (
          <TextArea
            hideLabel
            label={t('row.commentLabel')}
            className="mt-3"
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
