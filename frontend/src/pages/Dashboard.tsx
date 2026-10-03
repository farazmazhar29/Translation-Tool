import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { get, type S } from '../api/client'
import { Card, StatusBadge } from '../components/ui'
import { fmtDate } from '../lib/ui'

const Tile = ({ label, value, to }: { label: string; value: number; to: string }) => (
  <Link to={to} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-red-300">
    <div className="text-3xl font-semibold text-red-700">{value}</div>
    <div className="text-sm text-slate-600">{label}</div>
  </Link>
)

export default function Dashboard() {
  const { data: d } = useQuery({ queryKey: ['dashboard'], queryFn: () => get<S['DashboardOut']>('/dashboard') })
  if (!d) return <p className="text-slate-600">Laden …</p>
  const stats = d.stats
  const days = Object.entries(stats.releases_per_day)
  const max = Math.max(1, ...days.map(([, n]) => n))
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Offene Projekte" value={d.open} to="/projects?status=preview_ready" />
        <Tile label="In Prüfung" value={d.in_review} to="/projects?status=in_review" />
        <Tile label="Heute bearbeitet" value={d.edited_today} to="/projects" />
        <Tile label="Freigegeben" value={d.approved} to="/projects?status=approved" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Letzte Übersetzungen">
          {d.recent.length === 0 && <p className="text-sm text-slate-600">Noch keine Projekte.</p>}
          <ul className="divide-y">
            {d.recent.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <Link to={`/projects/${p.id}`} className="font-medium hover:text-red-700">
                  {p.name}
                </Link>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-slate-600">{fmtDate(p.updated_at)}</span>
                  <StatusBadge status={p.status} />
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Häufig verwendete Glossarbegriffe">
          {d.top_terms.length === 0 && <p className="text-sm text-slate-600">Noch keine Nutzung.</p>}
          <ul className="space-y-1 text-sm">
            {d.top_terms.map((t) => (
              <li key={t.id} className="flex justify-between">
                <span>{t.term}</span>
                <span className="text-slate-600">{t.count}×</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Statistik">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            {[
              ['Projekte', stats.projects_total],
              ['Segmente', stats.segments],
              ['Übersetzungen', stats.translations],
              ['Manuelle Änderungen', stats.manual_edits],
              ['Glossareinträge', stats.glossary_entries],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between border-b py-1">
                <dt className="text-slate-600">{String(k)}</dt>
                <dd className="font-medium">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card title="Freigaben (letzte 14 Tage)">
          <div className="flex h-28 items-end gap-1">
            {days.map(([day, n]) => (
              <div key={day} className="flex flex-1 flex-col items-center justify-end" title={`${day}: ${n}`}>
                <div
                  className="w-full rounded-t bg-red-600"
                  style={{ height: `${(n / max) * 100}%`, minHeight: n ? 4 : 1 }}
                />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
