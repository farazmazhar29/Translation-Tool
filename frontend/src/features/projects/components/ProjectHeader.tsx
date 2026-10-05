import { FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/features/auth'
import { can, type S } from '@/shared/api/client'
import { Card, ErrorText, StatusBadge } from '@/shared/components/ui'
import { fmtDate } from '@/shared/lib/ui'
import type { Run } from '../types'
import { TranslationSetup } from './TranslationSetup'
import { WorkflowSteps } from './WorkflowSteps'

/** Title, facts about the file, the workflow steps, translation setup and the progress of a running translation. */
export const ProjectHeader = ({
  project: p,
  editable,
  hasTranslation,
  run,
  error,
}: {
  project: S['ProjectDetail']
  editable: boolean
  hasTranslation: boolean
  run: Run
  error: unknown
}) => {
  const { t } = useTranslation('projects')
  const { user } = useAuth()
  return (
    <Card>
      <div className="grid gap-8 lg:grid-cols-[1fr_26rem] lg:items-center">
        <div className="flex gap-4">
          <span
            className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand"
            aria-hidden="true"
          >
            <FileText className="size-6" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold">{p.name}</h1>
            <p className="mt-1 text-sm text-stone-600">
              {t('view.meta', {
                filename: p.filename,
                type: p.file_type.toUpperCase(),
                segments: t('view.segments', { count: p.segments.length }),
                customer: p.customer ? ` · ${p.customer}` : '',
                by: p.created_by,
                date: fmtDate(p.created_at),
              })}
            </p>
            <p className="mt-2 text-xs text-stone-600">
              {t('view.detectedLang')}{' '}
              <strong className="text-ink">
                {p.detected_lang ? p.detected_lang.toUpperCase() : t('view.unclear')}
              </strong>{' '}
              · {t('view.structure')}{' '}
              {Object.entries(p.structure)
                .filter(([, v]) => typeof v === 'number')
                .map(([k, v]) => `${String(v)} ${k}`)
                .join(', ')}
            </p>
            {p.status === 'archived' && (
              <div className="mt-3">
                <StatusBadge status={p.status} />
              </div>
            )}
          </div>
        </div>
        <WorkflowSteps status={p.status} />
      </div>
      {editable && can(user, 'translator') && (
        <TranslationSetup project={p} hasTranslation={hasTranslation} run={run} />
      )}
      {p.job_state === 'running' && (
        <div className="mt-6" role="status">
          <div className="h-2.5 overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${String(p.job_progress)}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-stone-600">{t('view.translating', { progress: p.job_progress })}</p>
        </div>
      )}
      {p.job_state === 'error' && (
        <div className="mt-4">
          <ErrorText error={new Error(p.job_error)} />
        </div>
      )}
      <ErrorText error={error} />
    </Card>
  )
}
