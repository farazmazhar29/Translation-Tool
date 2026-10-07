import { useQuery } from '@tanstack/react-query'
import { BookPlus, Check, CornerDownRight, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError, get, post, put, type S } from '@/shared/api/client'
import { Checkbox } from '@/shared/components/form'
import { Btn, Card } from '@/shared/components/ui'
import { SEV } from '../constants'
import { findingText } from '../lib/findings'
import type { Run } from '../types'

type Finding = S['QualityWarning']

const OPTION_SEP = '|' // joins the translations of a contradiction in `params.options` (see quality/service.py)
const action =
  'inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand'

/**
 * Quality check of the target language, with a way to fix each finding: a finding on a segment opens that segment
 * for editing, a contradiction is unified on the translation the user picks (in every segment, optionally also in
 * the glossary), a frequent term missing from the glossary is added with the translation the text uses, and an
 * ambiguous term is confirmed through the glossary. What is a judgment call (anything but an error) can be accepted
 * as it is; accepted findings are no longer counted and can be reopened.
 */
export const QualityPanel = ({
  projectId,
  lang,
  srcLang,
  editable,
  run,
  onSegment,
}: {
  projectId: number
  lang: string
  srcLang: string
  editable: boolean // the user may change the translation (not after approval, not as a reviewer-only role)
  run: Run
  onSegment: (idx: number) => void
}) => {
  const { t } = useTranslation('projects')
  const [toGlossary, setToGlossary] = useState(true)
  const {
    data: quality,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['quality', projectId, lang],
    queryFn: () => get<S['QualityOut']>(`/projects/${projectId}/quality?lang=${lang}`),
    enabled: !!lang,
  })

  /** A term that is already in the glossary is fine: the entry is not overwritten from here. */
  const addToGlossary = async (source: string, target: string): Promise<void> => {
    try {
      await post('/glossary', { terms: { [srcLang]: source, [lang]: target } })
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 409)) throw e
    }
  }
  const unify = (f: Finding, chosen: string): void => {
    const others = (f.params['options'] ?? '').split(OPTION_SEP).filter((o) => o && o !== chosen)
    run(async () => {
      for (const old of others) await post(`/projects/${projectId}/replace-term`, { lang, old, new: chosen })
      if (toGlossary) await addToGlossary(f.params['term'] ?? '', chosen)
    })
  }
  const warnings = quality?.warnings ?? []
  const open = warnings.filter((w) => !w.accepted)
  const accepted = warnings.filter((w) => w.accepted)
  /** The project's accepted findings are sent as a whole: the current ones plus `add`, or none to reopen all. */
  const setAccepted = (keys: string[]): void => {
    run(() => put(`/projects/${projectId}/quality/accepted`, { keys }))
  }

  const fixes = (f: Finding) => {
    if (!editable) return null
    const term = f.params['term'] ?? ''
    const buttons = []
    if (f.code === 'contradiction') {
      for (const option of (f.params['options'] ?? '').split(OPTION_SEP).filter(Boolean)) {
        buttons.push(
          <button
            key={`use-${option}`}
            type="button"
            className={action}
            onClick={() => {
              unify(f, option)
            }}
          >
            <Check className="size-3.5" aria-hidden="true" />
            {t('quality.useEverywhere', { value: option })}
          </button>,
        )
      }
    }
    const target = f.params['target']
    if (f.code === 'missing_glossary' && target) {
      buttons.push(
        <button
          key="glossary"
          type="button"
          className={action}
          onClick={() => {
            run(() => addToGlossary(term, target))
          }}
        >
          <BookPlus className="size-3.5" aria-hidden="true" />
          {t('quality.addToGlossary', { source: term, target })}
        </button>,
      )
    }
    const source = f.params['source']
    if (f.code === 'ambiguous_term' && source && target) {
      // the glossary entry settles it: this and every later translation of the term is checked against it
      buttons.push(
        <button
          key="confirm"
          type="button"
          className={action}
          onClick={() => {
            run(() => addToGlossary(source, target))
          }}
        >
          <BookPlus className="size-3.5" aria-hidden="true" />
          {t('quality.confirm', { source, target })}
        </button>,
      )
    }
    if (f.severity !== 'error') {
      buttons.push(
        <button
          key="accept"
          type="button"
          className={action}
          onClick={() => {
            setAccepted([...accepted.map((w) => w.key), f.key])
          }}
        >
          <EyeOff className="size-3.5" aria-hidden="true" />
          {t('quality.accept')}
        </button>,
      )
    }
    return buttons
  }

  const contradictions = open.some((w) => w.code === 'contradiction')
  return (
    <Card title={t('quality.title')}>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <Btn
          onClick={() => {
            void refetch()
          }}
        >
          {t('quality.recheck')}
        </Btn>
        {isFetching
          ? t('quality.checking')
          : quality &&
            t('quality.summary', {
              warnings: open.length,
              errors: quality.errors,
              version: quality.glossary_version,
            })}
        {accepted.length > 0 && (
          <span className="text-stone-600">
            {t('quality.acceptedCount', { count: accepted.length })}
            {editable && (
              <button
                type="button"
                className="ml-2 font-semibold text-brand-dark hover:underline"
                onClick={() => {
                  setAccepted([])
                }}
              >
                {t('quality.reopen')}
              </button>
            )}
          </span>
        )}
        {editable && contradictions && (
          <Checkbox
            label={t('quality.alsoGlossary')}
            checked={toGlossary}
            onChange={setToGlossary}
            className="ml-auto"
          />
        )}
      </div>
      {quality && open.length === 0 && <p className="text-sm text-green-700">{t('quality.none')}</p>}
      <ul className="space-y-1.5 text-sm">
        {open.map((w) => {
          const actions = fixes(w)
          return (
            <li key={w.key} className={`rounded-lg px-3 py-2 ${SEV[w.severity] ?? ''}`}>
              <p>
                <strong>{w.idx >= 0 ? `#${String(w.idx + 1)}` : '•'}</strong> {findingText(w, t)}
              </p>
              {(w.idx >= 0 || (actions && actions.length > 0)) && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {w.idx >= 0 && (
                    <button
                      type="button"
                      className={action}
                      onClick={() => {
                        onSegment(w.idx)
                      }}
                    >
                      <CornerDownRight className="size-3.5" aria-hidden="true" />
                      {editable
                        ? t('quality.editSegment', { n: w.idx + 1 })
                        : t('quality.showSegment', { n: w.idx + 1 })}
                    </button>
                  )}
                  {actions}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
