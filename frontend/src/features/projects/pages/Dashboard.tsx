import { useQuery } from '@tanstack/react-query'
import {
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileText,
  FolderOpen,
  PencilLine,
  Plus,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useAuth } from '@/features/auth'
import { get, type S } from '@/shared/api/client'
import { EmptyState, Loading, PageHeader } from '@/shared/components/layout'
import { Card, LinkBtn, StatusBadge } from '@/shared/components/ui'
import { fmtDate, fmtDay } from '@/shared/lib/ui'

const Tile = ({ label, value, icon: Icon }: { label: string; value: number; icon: LucideIcon }) => (
  <div className="flex items-center gap-4 rounded-2xl border border-line bg-white p-5 shadow-card">
    <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-soft text-brand" aria-hidden="true">
      <Icon className="size-6" />
    </span>
    <span>
      <span className="block text-3xl font-bold leading-none">{value}</span>
      <span className="mt-1.5 block text-sm text-stone-600">{label}</span>
    </span>
  </div>
)

const Dashboard = () => {
  const { t } = useTranslation('projects')
  const { user } = useAuth()
  const name = user ? user.full_name || user.username : ''
  const { data: d } = useQuery({ queryKey: ['dashboard'], queryFn: () => get<S['DashboardOut']>('/dashboard') })
  if (!d) return <Loading />
  const stats = d.stats
  const days = Object.entries(stats.releases_per_day)
  const maxDay = Math.max(1, ...days.map(([, n]) => n))
  const maxTerm = Math.max(1, ...d.top_terms.map((term) => term.count))
  const releases = days.reduce((sum, [, n]) => sum + n, 0)
  return (
    <div className="space-y-8">
      <PageHeader title={t('dashboard.title')} subtitle={t('dashboard.greeting', { name: name })}>
        <LinkBtn to="/projects/new" variant="primary">
          <Plus className="size-4" aria-hidden="true" />
          {t('dashboard.newProject')}
        </LinkBtn>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label={t('dashboard.open')} value={d.open} icon={FolderOpen} />
        <Tile label={t('dashboard.inReview')} value={d.in_review} icon={ClipboardCheck} />
        <Tile label={t('dashboard.editedToday')} value={d.edited_today} icon={PencilLine} />
        <Tile label={t('dashboard.approved')} value={d.approved} icon={CheckCircle2} />
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <Card title={t('dashboard.recent')} className="xl:col-span-3">
          {d.recent.length === 0 ? (
            <EmptyState
              icon={<FileText className="size-6" />}
              action={
                <LinkBtn to="/projects/new" variant="primary">
                  {t('dashboard.createFirst')}
                </LinkBtn>
              }
            >
              {t('dashboard.noProjects')}
            </EmptyState>
          ) : (
            <ul className="-mx-3">
              {d.recent.map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/projects/${p.id}`}
                    className="group flex items-center gap-4 rounded-xl px-3 py-3 transition hover:bg-stone-50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold group-hover:text-brand">{p.name}</span>
                      <span className="block truncate text-xs text-stone-600">
                        {p.filename} · {fmtDate(p.updated_at)}
                      </span>
                    </span>
                    <StatusBadge status={p.status} archived={p.archived} />
                    <ChevronRight className="size-4 shrink-0 text-stone-400" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t('dashboard.topTerms')} className="xl:col-span-2">
          {d.top_terms.length === 0 ? (
            <EmptyState>{t('dashboard.noUsage')}</EmptyState>
          ) : (
            <ul className="space-y-4 text-sm">
              {d.top_terms.map((term) => (
                <li key={term.id}>
                  <div className="flex justify-between gap-3">
                    <span className="font-medium">{term.term}</span>
                    <span className="text-stone-600">{term.count}×</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-stone-100">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${(term.count / maxTerm) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t('dashboard.stats')} className="xl:col-span-2">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
            {[
              [t('dashboard.projects'), stats.projects_total],
              [t('dashboard.segments'), stats.segments],
              [t('dashboard.translations'), stats.translations],
              [t('dashboard.manualEdits'), stats.manual_edits],
              [t('dashboard.glossaryEntries'), stats.glossary_entries],
            ].map(([k, v]) => (
              <div key={String(k)}>
                <dd className="text-2xl font-bold">{String(v)}</dd>
                <dt className="text-xs text-stone-600">{String(k)}</dt>
              </div>
            ))}
          </dl>
        </Card>

        <Card title={t('dashboard.releases')} className="xl:col-span-3">
          <p className="-mt-2 mb-4 text-sm text-stone-600">{t('dashboard.releasesTotal', { count: releases })}</p>
          <div className="flex h-32 items-end gap-1.5">
            {days.map(([day, n]) => (
              <div key={day} className="flex h-full flex-1 flex-col justify-end" title={`${fmtDay(day)}: ${String(n)}`}>
                {n > 0 && <span className="mb-1 text-center text-xs font-semibold">{n}</span>}
                <div
                  className={`mx-auto w-full max-w-8 ${n ? 'rounded-t-md bg-brand' : 'rounded-full bg-stone-200'}`}
                  style={{ height: n ? `${String((n / maxDay) * 80)}%` : 4 }}
                />
              </div>
            ))}
          </div>
          {days.length > 0 && (
            <div className="mt-2 flex justify-between text-xs text-stone-600">
              <span>{fmtDay(days[0]?.[0] ?? '')}</span>
              <span>{t('dashboard.today')}</span>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

export default Dashboard
