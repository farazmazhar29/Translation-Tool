import { Check, Download, FileDown, History, RotateCcw, Send, ShieldCheck, Undo2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/features/auth'
import { can, download, get, post, type S } from '@/shared/api/client'
import { Btn } from '@/shared/components/ui'
import type { Panel, Run } from '../types'

const icon = 'size-4'

/** Language tabs and the buttons of the review workflow (quality, history, submit, approve, export ...). */
export const ProjectToolbar = ({
  project: p,
  lang,
  panel,
  editable,
  run,
  onLang,
  onPanel,
  onExport,
}: {
  project: S['ProjectDetail']
  lang: string
  panel: Panel
  editable: boolean
  run: Run
  onLang: (lang: string) => void
  onPanel: (panel: Panel) => void
  onExport: () => void
}) => {
  const { t } = useTranslation('projects')
  const { user } = useAuth()
  const id = p.id
  const isTranslator = can(user, 'translator')
  const isReviewer = can(user, 'reviewer')
  const approve = async (): Promise<void> => {
    const q = await get<S['QualityOut']>(`/projects/${id}/quality`)
    const msg = q.warnings.length
      ? t('view.confirmApproveWarnings', { warnings: q.warnings.length, errors: q.errors })
      : t('view.confirmApprove')
    if (window.confirm(msg)) run(() => post(`/projects/${id}/approve`))
  }
  const step = (path: string) => () => {
    run(() => post(`/projects/${id}/${path}`))
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-3 shadow-card">
      {p.target_langs.length > 1 && (
        <div className="flex rounded-full bg-stone-100 p-1">
          {p.target_langs.map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={l === lang}
              onClick={() => {
                onLang(l)
              }}
              className={`rounded-full px-4 py-1.5 text-sm font-bold transition ${l === lang ? 'bg-white text-ink shadow-sm' : 'text-stone-600 hover:text-ink'}`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      )}
      <Btn
        aria-pressed={panel === 'quality'}
        onClick={() => {
          onPanel(panel === 'quality' ? null : 'quality')
        }}
      >
        <ShieldCheck className={icon} aria-hidden="true" />
        {t('view.quality')}
      </Btn>
      <Btn
        aria-pressed={panel === 'history'}
        onClick={() => {
          onPanel(panel === 'history' ? null : 'history')
        }}
      >
        <History className={icon} aria-hidden="true" />
        {t('view.history')}
      </Btn>
      <span className="mx-1 hidden h-6 w-px bg-line sm:block" aria-hidden="true" />
      {isTranslator && p.status === 'preview_ready' && (
        <Btn onClick={step('submit-review')}>
          <Send className={icon} aria-hidden="true" />
          {t('view.submitReview')}
        </Btn>
      )}
      {isReviewer && p.status === 'in_review' && (
        <Btn variant="danger" onClick={step('reject')}>
          <Undo2 className={icon} aria-hidden="true" />
          {t('view.reject')}
        </Btn>
      )}
      {isReviewer && (p.status === 'preview_ready' || p.status === 'in_review') && (
        <Btn
          variant="primary"
          onClick={() => {
            void approve()
          }}
        >
          <Check className={icon} aria-hidden="true" />
          {t('view.approve')}
        </Btn>
      )}
      {(p.status === 'approved' || p.status === 'archived') && (
        <Btn variant="primary" onClick={onExport}>
          <Download className={icon} aria-hidden="true" />
          {t('view.export')}
        </Btn>
      )}
      {isTranslator && (p.status === 'approved' || p.status === 'archived') && (
        <Btn onClick={step('reopen')}>
          <RotateCcw className={icon} aria-hidden="true" />
          {t('view.reopen')}
        </Btn>
      )}
      <Btn
        variant="ghost"
        className="ml-auto"
        onClick={() => {
          void download(`/projects/${id}/original`, p.filename)
        }}
      >
        <FileDown className={icon} aria-hidden="true" />
        {t('view.original')}
      </Btn>
      {isTranslator && !editable && <p className="basis-full text-xs text-stone-600">{t('view.approvedHint')}</p>}
    </div>
  )
}
