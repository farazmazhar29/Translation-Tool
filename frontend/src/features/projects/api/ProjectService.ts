import { useApiRequest, useMutation, unwrap } from '@/shared/api/base'
import { API_CONFIG, AS_FILE, saveFile } from '@/shared/api/config'
import {
  DashboardApiFactory,
  ProjectsApiFactory,
  ReviewApiFactory,
  TranslationApiFactory,
  UsersApiFactory,
  type ProjectOut,
  type SegmentEdit,
  type TranslateIn,
} from '@/shared/api/generated'
import { LANGS, isStatus } from '@/shared/constants'
import { ARCHIVE_VALUES, POLL_MS } from '../constants'

const projects = ProjectsApiFactory(API_CONFIG)
const translation = TranslationApiFactory(API_CONFIG)
const review = ReviewApiFactory(API_CONFIG)
const dashboard = DashboardApiFactory(API_CONFIG)
const users = UsersApiFactory(API_CONFIG)

/** The filters of the project list as the form holds them; '' means "all". */
export type ProjectFilters = Record<
  'q' | 'status' | 'archived' | 'lang' | 'customer' | 'editor' | 'term' | 'date_from' | 'date_to',
  string
>
const isArchiveFilter = (value: string): value is (typeof ARCHIVE_VALUES)[number] =>
  (ARCHIVE_VALUES as readonly string[]).includes(value)
const SOURCE_LANGS = ['auto', ...LANGS] as const
const isSourceLang = (value: string): value is NonNullable<TranslateIn['source_lang']> =>
  (SOURCE_LANGS as readonly string[]).includes(value)

/** What the project list can do with one project from its row. */
export type RowAction = 'archive' | 'unarchive' | 'copy' | 'delete'
const ROW_ACTIONS: Record<RowAction, (pid: number) => Promise<unknown>> = {
  archive: (pid) => projects.archiveProject({ pid }),
  unarchive: (pid) => projects.unarchiveProject({ pid }),
  copy: (pid) => projects.copyProject({ pid }),
  delete: (pid) => projects.deleteProject({ pid }),
}

export const ProjectService = {
  useFetchDashboard() {
    return useApiRequest({ key: ['dashboard'], apiCall: () => dashboard.getDashboard() })
  },

  useFetchProjects(f: ProjectFilters) {
    return useApiRequest({
      key: ['projects', f],
      apiCall: () =>
        projects.listProjects({
          q: f.q || undefined,
          status: isStatus(f.status) ? f.status : undefined,
          archived: isArchiveFilter(f.archived) ? f.archived : undefined,
          lang: f.lang || undefined,
          customer: f.customer || undefined,
          editor: f.editor || undefined,
          term: f.term || undefined,
          dateFrom: f.date_from || undefined,
          dateTo: f.date_to || undefined,
        }),
    })
  },

  /** Names for the "editor" filter of the project list. */
  useFetchEditorNames() {
    return useApiRequest({
      key: ['editors'],
      apiCall: () => users.userNames(),
      // the schema says strings; the generator types inline response arrays as (string | null)[]
      postProcess: (names) => names.filter((name): name is string => name !== null),
    })
  },

  /** Archive, unarchive, copy or delete a project from the list. */
  useRowAction() {
    return useMutation(({ id, action }: { id: number; action: RowAction }) => ROW_ACTIONS[action](id), {
      invalidate: ['projects'],
    })
  },

  /** Uploads a file; the project is created from it. */
  useCreateProject(onSuccess: (project: ProjectOut) => void) {
    return useMutation(
      ({ file, name, customer, sourceLang }: { file: File; name: string; customer: string; sourceLang: string }) =>
        unwrap(projects.createProject({ file, name, customer, sourceLang })),
      { invalidate: ['projects', 'dashboard'], onSuccess },
    )
  },

  /** A project with its segments and translations. */
  useFetchProject(pid: number) {
    return useApiRequest({ key: ['project', pid], apiCall: () => projects.getProjectDetail({ pid }) })
  },

  /**
   * The progress of a running translation. Asks the small status endpoint every POLL_MS instead of loading the whole
   * project again and again; when the job is over, `onFinished` loads the project once.
   */
  useFetchJobStatus(pid: number, running: boolean, onFinished: () => void) {
    return useApiRequest({
      key: ['project-status', pid],
      apiCall: () => translation.getJobStatus({ pid }),
      postProcess: (job) => {
        if (job.job_state !== 'running') onFinished()
        return job
      },
      preventRequest: !running,
      options: { refetchInterval: (query) => (query.state.data?.job_state === 'running' ? POLL_MS : false) },
    })
  },

  /** The cells of the original Excel sheet, for the table view. The file does not change, so they are loaded once. */
  useFetchSheetCells(pid: number) {
    return useApiRequest({
      key: ['project-cells', pid],
      apiCall: () => projects.getSheetCells({ pid }),
      options: { staleTime: Infinity },
    })
  },

  // Actions on one project. The project page runs them through one mutation (its "saving" notice and error),
  // so they are plain functions here.
  /** `sourceLang` as the form holds it: 'auto', 'de' or 'en'. */
  startTranslation: (pid: number, sourceLang: string) =>
    unwrap(
      translation.startTranslation({
        pid,
        translateIn: { source_lang: isSourceLang(sourceLang) ? sourceLang : undefined },
      }),
    ),
  editSegment: (sid: number, lang: string, edit: SegmentEdit) =>
    unwrap(translation.editSegment({ sid, lang, segmentEdit: edit })),
  retranslateSegment: (sid: number, lang: string) => unwrap(translation.retranslateSegment({ sid, lang })),
  /**
   * Replaces a translated term (whole words) in every segment, or only in `segmentId`; a capital at a sentence start
   * is kept. The stored terms follow, also the one for `source` when an earlier edit had changed its text.
   * Resolves to the number of segments changed.
   */
  replaceTerm: async (
    pid: number,
    lang: string,
    old: string,
    value: string,
    { segmentId, source }: { segmentId?: number; source?: string } = {},
  ) => {
    const termReplace = { lang, old, new: value, segment_id: segmentId, source }
    const result = await unwrap(translation.replaceTerm({ pid, termReplace }))
    return result['replaced_in_segments'] ?? 0
  },
  approve: (pid: number) => unwrap(review.approveProject({ pid })),
  reopen: (pid: number) => unwrap(review.reopenProject({ pid })),

  downloadOriginal: (pid: number, filename: string) => saveFile(projects.downloadOriginal({ pid }, AS_FILE), filename),
}
