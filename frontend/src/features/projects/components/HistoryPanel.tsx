import { useTranslation } from 'react-i18next'
import { ExportService } from '../api/ExportService'
import { Card } from '@/shared/components/ui'
import { fmtDate } from '@/shared/lib/ui'

/** Releases (approvals) and exports of a project. */
export const HistoryPanel = ({ projectId }: { projectId: number }) => {
  const { t } = useTranslation('projects')
  const { data: history } = ExportService.useFetchHistory(projectId)
  return (
    <Card title={t('historyPanel.title')}>
      {history?.releases.length === 0 && <p className="text-sm text-stone-600">{t('historyPanel.none')}</p>}
      <ul className="divide-y text-sm">
        {history?.releases.map((r) => (
          <li key={r.id} className="py-2">
            <strong>{t('historyPanel.release', { id: r.id })}</strong>
            {t('historyPanel.details', {
              by: r.approved_by,
              date: fmtDate(r.created_at),
              version: r.glossary_version,
              changes: r.change_count,
              editors: r.editors.join(', '),
              warnings: r.warnings.length,
            })}
          </li>
        ))}
      </ul>
      {history && history.exports.length > 0 && (
        <h3 className="mb-1 mt-3 text-xs font-semibold uppercase text-stone-600">{t('historyPanel.exports')}</h3>
      )}
      <ul className="space-y-1 text-sm">
        {history?.exports.map((e) => (
          <li key={e.id} className="flex items-center gap-2">
            <button
              type="button"
              className="text-blue-700 hover:underline"
              onClick={() => {
                void ExportService.downloadExport(e.id, e.filename)
              }}
            >
              {e.filename}
            </button>
            <span className="text-xs text-stone-600">
              {e.created_by} · {fmtDate(e.created_at)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
