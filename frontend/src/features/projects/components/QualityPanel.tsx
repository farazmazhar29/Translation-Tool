import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { get, type S } from '@/shared/api/client'
import { Btn, Card } from '@/shared/components/ui'
import { SEV } from '../constants'

/** Quality check of one target language; clicking a finding scrolls to the segment. */
export const QualityPanel = ({ projectId, lang }: { projectId: number; lang: string }) => {
  const { t } = useTranslation('projects')
  const {
    data: quality,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['quality', projectId, lang],
    queryFn: () => get<S['QualityOut']>(`/projects/${projectId}/quality?lang=${lang}`),
    enabled: !!lang,
  })
  return (
    <Card title={t('quality.title')}>
      <div className="mb-2 flex items-center gap-3 text-sm">
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
              warnings: quality.warnings.length,
              errors: quality.errors,
              version: quality.glossary_version,
            })}
      </div>
      {quality?.warnings.length === 0 && <p className="text-sm text-green-700">{t('quality.none')}</p>}
      <ul className="space-y-1 text-sm">
        {quality?.warnings.map((w, i) => (
          <li key={i}>
            <button
              type="button"
              className={`w-full rounded px-2 py-1 text-left ${SEV[w.severity] ?? ''}`}
              onClick={() =>
                document.getElementById(`seg-${String(w.idx)}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }
            >
              <strong>{w.idx >= 0 ? `#${String(w.idx + 1)}` : '•'}</strong> {w.message}
            </button>
          </li>
        ))}
      </ul>
    </Card>
  )
}
