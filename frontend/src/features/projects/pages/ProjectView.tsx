import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { useAuth } from '@/features/auth'
import { TermDialog } from '@/features/glossary'
import { can, get, post, put, type S } from '@/shared/api/client'
import { BackLink, Loading } from '@/shared/components/layout'
import { Card, ErrorText, Modal } from '@/shared/components/ui'
import { useAction, useInvalidate } from '@/shared/lib/hooks'
import { ExportDialog } from '../components/ExportDialog'
import { HistoryPanel } from '../components/HistoryPanel'
import { ProjectHeader } from '../components/ProjectHeader'
import { ProjectToolbar } from '../components/ProjectToolbar'
import { QualityPanel } from '../components/QualityPanel'
import { SegmentTable } from '../components/SegmentTable'
import { TermLegend } from '../components/TermLegend'
import { EDITABLE, PROJECT_QUERIES } from '../constants'
import type { Panel, Run, Segment } from '../types'

/** One project: translation setup, review workflow and the segments. The parts live in `../components`. */
const ProjectView = () => {
  const { t } = useTranslation(['projects', 'common'])
  const id = Number(useParams()['id'])
  const { user } = useAuth()
  const [picked, setLang] = useState('')
  const [panel, setPanel] = useState<Panel>(null)
  const [modal, setModal] = useState<{ kind: 'term'; seg: Segment; term: S['Term'] } | { kind: 'export' } | null>(null)

  const { data: p, error } = useQuery({
    queryKey: ['project', id],
    queryFn: () => get<S['ProjectDetail']>(`/projects/${id}`),
    refetchInterval: (q) => (q.state.data?.job_state === 'running' ? 1500 : false),
  })
  const refresh = useInvalidate(PROJECT_QUERIES)
  const act = useAction((fn: () => Promise<unknown>) => fn(), { invalidate: PROJECT_QUERIES })
  const run: Run = (fn) => {
    act.mutate(fn)
  }

  if (error) return <ErrorText error={error} />
  if (!p) return <Loading />

  const lang = p.target_langs.includes(picked) ? picked : (p.target_langs[0] ?? '')
  const editable = EDITABLE.includes(p.status)
  const canEdit = editable && can(user, 'translator')
  const running = p.job_state === 'running'
  const hasTranslation = p.segments.some((s) => Object.keys(s.translations).length > 0)
  const srcLang = p.source_lang === 'auto' ? p.detected_lang : p.source_lang
  const save = (seg: Segment, body: S['SegmentEdit']): void => {
    run(() => put(`/segments/${seg.id}/${lang}`, { ...body }))
  }
  return (
    <div className="space-y-4">
      <BackLink to="/projects">{t('common:backToProjects')}</BackLink>
      <ProjectHeader project={p} editable={editable} hasTranslation={hasTranslation} run={run} error={act.error} />
      {hasTranslation && (
        <>
          <ProjectToolbar
            project={p}
            lang={lang}
            panel={panel}
            editable={editable}
            run={run}
            onLang={setLang}
            onPanel={setPanel}
            onExport={() => {
              setModal({ kind: 'export' })
            }}
          />
          <TermLegend />
        </>
      )}
      {panel === 'quality' && <QualityPanel projectId={id} lang={lang} />}
      {panel === 'history' && <HistoryPanel projectId={id} />}
      {hasTranslation && (
        <SegmentTable
          segments={p.segments}
          lang={lang}
          srcLang={srcLang}
          editable={canEdit}
          busy={act.isPending}
          onTerm={(seg, term) => {
            setModal({ kind: 'term', seg, term })
          }}
          onSave={save}
          onRegenerate={(seg) => {
            run(() => post(`/segments/${seg.id}/${lang}/retranslate`))
          }}
        />
      )}
      {!hasTranslation && !running && (
        <Card>
          <p className="text-sm text-stone-600">{t('view.analyzed')}</p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-stone-600">
            {p.segments.slice(0, 15).map((s) => (
              <li key={s.id}>{s.source_text.slice(0, 160)}</li>
            ))}
          </ol>
        </Card>
      )}

      {modal?.kind === 'term' && (
        <TermDialog
          term={modal.term}
          seg={modal.seg}
          lang={lang}
          src={srcLang}
          projectId={id}
          editable={canEdit}
          onClose={() => {
            setModal(null)
          }}
          onSegmentText={(text) => {
            save(modal.seg, { text })
          }}
          onChanged={() => {
            void refresh()
          }}
        />
      )}
      {modal?.kind === 'export' && (
        <ExportDialog
          project={p}
          lang={lang}
          onClose={() => {
            setModal(null)
          }}
          onDone={() => {
            setModal(null)
            void refresh()
          }}
        />
      )}
      {act.isPending && (
        <Modal title={t('view.pleaseWait')} onClose={() => undefined}>
          <p className="text-sm text-stone-600">{t('view.running')}</p>
        </Modal>
      )}
    </div>
  )
}

export default ProjectView
