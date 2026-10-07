import { Check, Download, History, RotateCcw, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/features/auth'
import { can, get, post, type S } from '@/shared/api/client'
import { useConfirm } from '@/shared/components/confirm'
import { Btn } from '@/shared/components/ui'
import { SEV } from '../constants'
import { findingText } from '../lib/findings'
import type { Panel, Run } from '../types'

const icon = 'size-4'
const SHOWN_FINDINGS = 5

/** The buttons of the review workflow (quality, history, approve, export ...). */
export const ProjectToolbar = ({
  project: p,
  panel,
  editable,
  run,
  onPanel,
  onExport,
}: {
  project: S['ProjectDetail']
  panel: Panel
  editable: boolean
  run: Run
  onPanel: (panel: Panel) => void
  onExport: () => void
}) => {
  const { t } = useTranslation('projects')
  const { user } = useAuth()
  const { confirm, dialog } = useConfirm()
  const id = p.id
  const isTranslator = can(user, 'translator')
  const isReviewer = can(user, 'reviewer')
  const approve = async (): Promise<void> => {
    const { warnings } = await get<S['QualityOut']>(`/projects/${id}/quality`)
    // Hints (severity "info") are advice and stay in the quality check; only real problems are worth a question,
    // and not the ones the reviewer already looked at and accepted.
    const problems = warnings.filter((w) => w.severity !== 'info' && !w.accepted)
    const count = (severity: string): number => problems.filter((w) => w.severity === severity).length
    const message = problems.length
      ? t('view.confirmApproveProblems', { errors: count('error'), warnings: count('warning') })
      : t('view.confirmApprove')
    const approved = await confirm({
      title: t('view.approveTitle'),
      message,
      confirmLabel: t('view.approve'),
      details: (close) =>
        problems.length > 0 && (
          <div className="mt-4">
            <ul className="max-h-56 space-y-2 overflow-y-auto rounded-xl bg-stone-50 p-3 text-sm">
              {problems.slice(0, SHOWN_FINDINGS).map((w, i) => (
                <li key={i} className="flex gap-2">
                  <span
                    className={`mt-0.5 h-fit shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${SEV[w.severity] ?? ''}`}
                  >
                    {t(`view.severity.${w.severity}`)}
                  </span>
                  <span>{findingText(w, t)}</span>
                </li>
              ))}
              {problems.length > SHOWN_FINDINGS && (
                <li className="text-stone-600">
                  {t('view.moreFindings', { count: problems.length - SHOWN_FINDINGS })}
                </li>
              )}
            </ul>
            <button
              type="button"
              className="mt-3 text-sm font-semibold text-brand-dark hover:underline"
              onClick={() => {
                close(false)
                onPanel('quality')
              }}
            >
              {t('view.openQuality')}
            </button>
          </div>
        ),
    })
    if (approved) run(() => post(`/projects/${id}/approve`))
  }
  const step = (path: string) => () => {
    run(() => post(`/projects/${id}/${path}`))
  }
  return (
    <>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-3 shadow-card">
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
        {isReviewer && p.status === 'preview_ready' && (
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
        {isTranslator && !editable && <p className="basis-full text-xs text-stone-600">{t('view.approvedHint')}</p>}
      </div>
      {dialog}
    </>
  )
}
