import { useTranslation } from 'react-i18next'
import { useAuth } from '@/features/auth'
import { can, download, get, post, type S } from '@/shared/api/client'
import { Btn } from '@/shared/components/ui'
import type { Panel, Run } from '../types'

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
    <div className="flex flex-wrap items-center gap-2">
      {p.target_langs.length > 1 && (
        <div className="mr-2 flex overflow-hidden rounded-md border">
          {p.target_langs.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => {
                onLang(l)
              }}
              className={`px-3 py-1.5 text-sm ${l === lang ? 'bg-red-700 text-white' : 'bg-white'}`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      )}
      <Btn
        onClick={() => {
          onPanel(panel === 'quality' ? null : 'quality')
        }}
      >
        {t('view.quality')}
      </Btn>
      <Btn
        onClick={() => {
          onPanel(panel === 'history' ? null : 'history')
        }}
      >
        {t('view.history')}
      </Btn>
      {isTranslator && p.status === 'preview_ready' && (
        <Btn onClick={step('submit-review')}>{t('view.submitReview')}</Btn>
      )}
      {isReviewer && p.status === 'in_review' && (
        <Btn variant="danger" onClick={step('reject')}>
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
          {t('view.approve')}
        </Btn>
      )}
      {(p.status === 'approved' || p.status === 'archived') && (
        <Btn
          variant="primary"
          onClick={() => {
            onExport()
          }}
        >
          {t('view.export')}
        </Btn>
      )}
      {isTranslator && (p.status === 'approved' || p.status === 'archived') && (
        <Btn onClick={step('reopen')}>{t('view.reopen')}</Btn>
      )}
      <Btn
        variant="ghost"
        onClick={() => {
          void download(`/projects/${id}/original`, p.filename)
        }}
      >
        {t('view.original')}
      </Btn>
      {isTranslator && !editable && <span className="text-xs text-slate-600">{t('view.approvedHint')}</span>}
    </div>
  )
}
