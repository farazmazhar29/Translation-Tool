import { useApiRequest, useMutation, unwrap } from '@/shared/api/base'
import { API_CONFIG, AS_FILE, saveFile } from '@/shared/api/config'
import {
  GlossaryApiFactory,
  type DuplicateGroup,
  type GlossaryIn,
  type GlossaryStatus,
  type ImportResult,
} from '@/shared/api/generated'
import { isEntryCategory, isEntryStatus } from '../constants'

const api = GlossaryApiFactory(API_CONFIG)

/** The filters of the glossary list as the form holds them; '' means "all". */
interface EntryFilters {
  q: string
  status: string
  category: string
}
export const NO_FILTERS: EntryFilters = { q: '', status: '', category: '' }

export const GlossaryService = {
  /** Entries matching the filters (all by default; the term dialog shares this list). */
  useFetchEntries(filters: EntryFilters = NO_FILTERS, preventRequest = false) {
    return useApiRequest({
      key: ['glossary', filters],
      apiCall: () =>
        api.listEntries({
          q: filters.q || undefined,
          status: isEntryStatus(filters.status) ? filters.status : undefined,
          category: isEntryCategory(filters.category) ? filters.category : undefined,
        }),
      preventRequest,
    })
  },

  /** The saved versions of one entry, while `id` is set. */
  useFetchEntryVersions(id: number | undefined) {
    return useApiRequest({
      key: ['glossary-versions', id],
      apiCall: () => api.entryVersions({ eid: id ?? 0 }),
      preventRequest: id === undefined,
    })
  },

  /** Creates an entry, or updates the one with `id`. A duplicate answers 409 with the entries it matches. */
  useCreateOrUpdateEntry(onSuccess?: () => void) {
    return useMutation(
      ({ id, entry }: { id?: number; entry: GlossaryIn }) =>
        unwrap(id ? api.updateEntry({ eid: id, glossaryIn: entry }) : api.createEntry({ glossaryIn: entry })),
      { invalidate: ['glossary'], onSuccess },
    )
  },

  /** Approves or rejects an entry (reviewers). */
  useSetEntryStatus() {
    return useMutation(
      ({ id, status }: { id: number; status: GlossaryStatus }) => unwrap(api.setEntryStatus({ eid: id, status })),
      { invalidate: ['glossary'] },
    )
  },

  useDeleteEntry() {
    return useMutation((id: number) => unwrap(api.deleteEntry({ eid: id })), { invalidate: ['glossary'] })
  },

  useImportGlossary(onSuccess: (result: ImportResult) => void) {
    return useMutation((file: File) => unwrap(api.importGlossary({ file })), { invalidate: ['glossary'], onSuccess })
  },

  /** Finds entries that share a term, on request (a button), so a mutation rather than a query. */
  useScanDuplicates(onSuccess: (groups: DuplicateGroup[]) => void) {
    return useMutation(() => unwrap(api.scanDuplicates()), { onSuccess })
  },

  /** A term with its translation, from outside the glossary page (the quality check). */
  addEntry: (terms: Record<string, string>) => unwrap(api.createEntry({ glossaryIn: { terms } })),

  exportGlossary: () => saveFile(api.exportGlossary(AS_FILE), 'glossar.xlsx'),
}
