import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { useAuth } from '@/features/auth'
import { TermDialog } from '@/features/glossary'
import { can, get, post, put, type S } from '@/shared/api/client'
import { BackLink, Loading } from '@/shared/components/layout'
import { ErrorText } from '@/shared/components/ui'
import { useAction, useInvalidate } from '@/shared/lib/hooks'
import { ExportDialog } from '../components/ExportDialog'
import { HistoryPanel } from '../components/HistoryPanel'
import { ProjectHeader } from '../components/ProjectHeader'
import { ProjectToolbar } from '../components/ProjectToolbar'
import { PageView } from '../components/PageView'
import { QualityPanel } from '../components/QualityPanel'
import { SaveStatus } from '../components/SaveStatus'
import { SegmentTable } from '../components/SegmentTable'
import { SheetView } from '../components/SheetView'
import { SourcePreview } from '../components/SourcePreview'
import { TermLegend } from '../components/TermLegend'
import { ViewSwitch } from '../components/ViewSwitch'
import { EDITABLE, POLL_MS, PROJECT_QUERIES } from '../constants'
import type { Panel, Run, Segment } from '../types'

/** One project: translation setup, review workflow and the segments. The parts live in `../components`. */
const ProjectView = () => {
  const { t } = useTranslation(['projects', 'common'])
  const id = Number(useParams()['id'])
  const { user } = useAuth()
  const [panel, setPanel] = useState<Panel>(null)
  const [view, setView] = useState<'page' | 'list'>('page')
  const [modal, setModal] = useState<{ kind: 'term'; seg: Segment; term: S['Term'] } | { kind: 'export' } | null>(null)

  const { data: p, error } = useQuery({
    queryKey: ['project', id],
    queryFn: () => get<S['ProjectDetail']>(`/projects/${id}`),
  })
  const refresh = useInvalidate(PROJECT_QUERIES)
  // While the translation runs, ask the small status endpoint (a few hundred bytes) instead of loading the whole
  // project with all its segments again and again; when the job is over, load the project once.
  const { data: status } = useQuery({
    queryKey: ['project-status', id],
    queryFn: async () => {
      const job = await get<S['JobStatus']>(`/projects/${id}/status`)
      if (job.job_state !== 'running') void refresh()
      return job
    },
    enabled: p?.job_state === 'running',
    refetchInterval: (q) => (q.state.data?.job_state === 'running' ? POLL_MS : false),
  })
  const act = useAction((fn: () => Promise<unknown>) => fn(), { invalidate: PROJECT_QUERIES })
  const run: Run = (fn) => {
    act.mutate(fn)
  }

  if (error) return <ErrorText error={error} />
  if (!p) return <Loading />

  const lang = p.target_langs[0] ?? '' // always the other language (none while the source is unknown)
  const editable = EDITABLE.includes(p.status)
  const canEdit = editable && can(user, 'translator')
  const running = p.job_state === 'running'
  const hasTranslation = p.segments.some((s) => Object.keys(s.translations).length > 0)
  const srcLang = p.source_lang === 'auto' ? p.detected_lang : p.source_lang
  const isSheet = p.file_type === 'xlsx'
  const save = (seg: Segment, body: S['SegmentEdit']): void => {
    run(() => put(`/segments/${seg.id}/${lang}`, { ...body }))
  }
  return (
    <div className="space-y-4">
      <BackLink to="/projects">{t('common:backToProjects')}</BackLink>
      <ProjectHeader
        project={p}
        progress={status?.job_state === 'running' ? status.job_progress : undefined}
        editable={editable}
        hasTranslation={hasTranslation}
        run={run}
        error={act.error}
      />
      {hasTranslation && (
        <>
          <ProjectToolbar
            project={p}
            panel={panel}
            editable={editable}
            run={run}
            onPanel={setPanel}
            onExport={() => {
              setModal({ kind: 'export' })
            }}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TermLegend />
            <ViewSwitch value={view} table={isSheet} onChange={setView} />
          </div>
        </>
      )}
      {panel === 'quality' && <QualityPanel projectId={id} lang={lang} />}
      {panel === 'history' && <HistoryPanel projectId={id} />}
      {hasTranslation && view === 'page' && isSheet && (
        <SheetView
          projectId={id}
          segments={p.segments}
          lang={lang}
          srcLang={srcLang}
          onTerm={(seg, term) => {
            setModal({ kind: 'term', seg, term })
          }}
        />
      )}
      {hasTranslation && view === 'page' && !isSheet && (
        <PageView
          segments={p.segments}
          lang={lang}
          srcLang={srcLang}
          onTerm={(seg, term) => {
            setModal({ kind: 'term', seg, term })
          }}
        />
      )}
      {hasTranslation && view === 'list' && (
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
      {!hasTranslation && !running && <SourcePreview segments={p.segments} />}

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
      <SaveStatus pending={act.isPending} failed={act.isError} />
    </div>
  )
}

export default ProjectView
