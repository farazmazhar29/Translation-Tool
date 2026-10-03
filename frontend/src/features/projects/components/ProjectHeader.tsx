import { useTranslation } from 'react-i18next'
import { useAuth } from '@/features/auth'
import { can, type S } from '@/shared/api/client'
import { Card, ErrorText, StatusBadge } from '@/shared/components/ui'
import { fmtDate } from '@/shared/lib/ui'
import type { Run } from '../types'
import { TranslationSetup } from './TranslationSetup'

/** Title, facts about the file, translation setup and the progress of a running translation. */
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{p.name}</h1>
          <p className="text-sm text-slate-600">
            {t('view.meta', {
              filename: p.filename,
              type: p.file_type.toUpperCase(),
              segments: t('view.segments', { count: p.segments.length }),
              customer: p.customer ? ` · ${p.customer}` : '',
              by: p.created_by,
              date: fmtDate(p.created_at),
            })}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {t('view.detectedLang')}{' '}
            <strong>{p.detected_lang ? p.detected_lang.toUpperCase() : t('view.unclear')}</strong> ·{' '}
            {t('view.structure')}{' '}
            {Object.entries(p.structure)
              .filter(([, v]) => typeof v === 'number')
              .map(([k, v]) => `${String(v)} ${k}`)
              .join(', ')}
          </p>
        </div>
        <StatusBadge status={p.status} />
      </div>
      {editable && can(user, 'translator') && (
        <TranslationSetup project={p} hasTranslation={hasTranslation} run={run} />
      )}
      {p.job_state === 'running' && (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded bg-slate-200">
            <div className="h-full bg-red-600 transition-all" style={{ width: `${String(p.job_progress)}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-600">{t('view.translating', { progress: p.job_progress })}</p>
        </div>
      )}
      {p.job_state === 'error' && (
        <div className="mt-3">
          <ErrorText error={new Error(p.job_error)} />
        </div>
      )}
      <ErrorText error={error} />
    </Card>
  )
}
