/** While a translation runs, its progress is asked for this often (milliseconds). */
export const POLL_MS = 1500
/** How long a segment opened from the quality check stays marked (milliseconds). */
export const FOCUS_MS = 3000

/** Project states in which segments may still be edited. */
export const EDITABLE = ['new', 'preview_ready']
/** Query keys of everything that shows project data (refreshed after each change). */
export const PROJECT_QUERIES = ['project', 'quality', 'history'] // everything that shows project data
/** Badge colours of the quality-check severities. */
export const SEV: Record<string, string> = {
  error: 'bg-red-100 text-red-800',
  warning: 'bg-amber-100 text-amber-800',
  info: 'bg-blue-50 text-blue-800',
}

/** Values of the archive filter; their labels are `filters.archive.*`. */
export const ARCHIVE_VALUES = ['no', 'only', 'all'] as const

/** Spreadsheet column letters: up to three letters or empty. */
export const COLUMN = /^[A-Za-z]{0,3}$/

/** Default Excel layout; the sheet name is a translated text, so the caller passes it. */
export const defaultLayout = (sheetName: string) => ({
  sheet_name: sheetName,
  source_col: 'A',
  target_col: 'B',
  comment_col: 'C',
  location_col: '',
  start_row: 2,
  header: true,
})
