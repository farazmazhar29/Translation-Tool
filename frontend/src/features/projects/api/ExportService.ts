import { useApiRequest, useMutation, unwrap } from '@/shared/api/base'
import { API_CONFIG, AS_FILE, saveFile } from '@/shared/api/config'
import {
  ExportApiFactory,
  ExportTemplatesApiFactory,
  ReviewApiFactory,
  type ExportIn,
  type TemplateIn,
} from '@/shared/api/generated'

const exports = ExportApiFactory(API_CONFIG)
const templates = ExportTemplatesApiFactory(API_CONFIG)
const review = ReviewApiFactory(API_CONFIG)

const downloadExport = (id: number, filename: string) =>
  saveFile(exports.downloadExport({ eid: id }, AS_FILE), filename)

export const ExportService = {
  /** Approvals and exports of a project. */
  useFetchHistory(pid: number) {
    return useApiRequest({ key: ['history', pid], apiCall: () => review.projectHistory({ pid }) })
  },

  /** Saved Excel layouts. */
  useFetchTemplates() {
    return useApiRequest({ key: ['templates'], apiCall: () => templates.listTemplates() })
  },

  useCreateTemplate(onSuccess?: () => void) {
    return useMutation((template: TemplateIn) => unwrap(templates.createTemplate({ templateIn: template })), {
      invalidate: ['templates'],
      onSuccess,
    })
  },

  /** Creates the export file and downloads it. Archiving afterwards changes the project, so it is refreshed. */
  useExportProject(onSuccess?: () => void) {
    return useMutation(
      async ({ pid, request }: { pid: number; request: ExportIn }) => {
        const file = await unwrap(exports.exportProject({ pid, exportIn: request }))
        await downloadExport(file.id, file.filename)
      },
      { invalidate: ['project', 'projects', 'history', 'dashboard'], onSuccess },
    )
  },

  downloadExport,
}
