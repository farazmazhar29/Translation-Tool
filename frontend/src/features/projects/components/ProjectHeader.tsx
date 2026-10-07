import { FileDown, FileText } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useAuth } from '@/features/auth'
import { can, download, type S } from '@/shared/api/client'
import { Card, ErrorText, StatusBadge } from '@/shared/components/ui'
import { fmtDate } from '@/shared/lib/ui'
import type { Run } from '../types'
import { TranslationSetup } from './TranslationSetup'
import { WorkflowSteps } from './WorkflowSteps'

const Fact = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="min-w-0">
    <dt className="text-xs font-semibold uppercase tracking-wider text-stone-600">{label}</dt>
    <dd className="mt-1 truncate text-sm font-semibold">{children}</dd>
  </div>
)

const STRUCTURE_UNITS = ['pages', 'blocks', 'paragraphs', 'sheets'] as const

/** "1 page · 13 text blocks": the counts the parser reported, with readable names. */
const structure = (counts: Record<string, unknown>, t: TFunction<'projects'>): string =>
  Object.entries(counts)
    .filter(([, value]) => typeof value === 'number')
    .map(([unit, value]) => {
      const n = Number(value)
      return (STRUCTURE_UNITS as readonly string[]).includes(unit)
        ? t(`structure.${unit as (typeof STRUCTURE_UNITS)[number]}`, { count: n })
        : `${String(n)} ${unit}`
    })
    .join(' · ')

/** Title, facts about the file, the workflow steps, translation setup and the progress of a running translation. */
export const ProjectHeader = ({
  project: p,
  progress,
  editable,
  hasTranslation,
  run,
  error,
}: {
  project: S['ProjectDetail']
  progress?: number // the live value while a job runs; the project itself is only reloaded when it is over
  editable: boolean
  hasTranslation: boolean
  run: Run
  error: unknown
}) => {
  const { t } = useTranslation('projects')
  const { user } = useAuth()
  return (
    <Card>
      <div className="grid gap-8 xl:grid-cols-[1fr_26rem] xl:items-center">
        <div className="flex items-start gap-4">
          <span
            className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand"
            aria-hidden="true"
          >
            <FileText className="size-6" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold">{p.name}</h1>
            {p.status === 'archived' && (
              <div className="mt-3">
                <StatusBadge status={p.status} />
              </div>
            )}
          </div>
        </div>
        <WorkflowSteps status={p.status} />
      </div>
      <dl className="mt-6 grid gap-x-8 gap-y-4 border-t border-line pt-6 sm:grid-cols-2 xl:grid-cols-3">
        <Fact label={t('facts.file')}>
          <span className="flex items-center gap-1.5">
            <span className="truncate">{p.filename}</span>
            <button
              type="button"
              aria-label={t('view.original')}
              title={t('view.original')}
              className="grid size-7 shrink-0 place-items-center rounded-full text-stone-600 transition hover:bg-stone-100 hover:text-ink"
              onClick={() => {
                void download(`/projects/${p.id}/original`, p.filename)
              }}
            >
              <FileDown className="size-4" aria-hidden="true" />
            </button>
          </span>
        </Fact>
        <Fact label={t('facts.type')}>{p.file_type.toUpperCase()}</Fact>
        <Fact label={t('facts.segments')}>{t('view.segments', { count: p.segments.length })}</Fact>
        <Fact label={t('facts.language')}>{p.detected_lang ? p.detected_lang.toUpperCase() : t('view.unclear')}</Fact>
        <Fact label={t('facts.structure')}>{structure(p.structure, t)}</Fact>
        <Fact label={t('facts.created')}>
          {p.created_by} · {fmtDate(p.created_at)}
          {p.customer ? ` · ${p.customer}` : ''}
        </Fact>
      </dl>
      {editable && can(user, 'translator') && (
        <TranslationSetup project={p} hasTranslation={hasTranslation} run={run} />
      )}
      {p.job_state === 'running' && (
        <div className="mt-6" role="status">
          <div className="h-2.5 overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${String(progress ?? p.job_progress)}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-stone-600">
            {t('view.translating', { progress: progress ?? p.job_progress })}
          </p>
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
