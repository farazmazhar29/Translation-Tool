import type { Lang, Role, Term } from './api/generated'

/** Values the API uses. Their labels are translated: see `shared/i18n` (`lang.*`, `status.*`, ...). */
export const LANGS: readonly Lang[] = ['de', 'en']
export const ROLES: readonly Role[] = ['translator', 'reviewer', 'admin']
export const TERM_CATEGORIES: readonly Term['category'][] = [
  'technical',
  'glossary',
  'ambiguous',
  'unknown',
  'protected',
]
export const EXPORT_FORMATS = ['docx', 'xlsx', 'pdf'] as const
export const EXPORT_MODES = ['translation', 'both'] as const

/** Whether a string from a form or a setting is one of the allowed values (and has their type). */
export const isOneOf = <T extends string>(values: readonly T[], value: string): value is T =>
  (values as readonly string[]).includes(value)

/** Colours per project status: `chip` for the badge, `dot` for the small circle in it (and the workflow steps). */
export const STATUS_STYLE = {
  new: { chip: 'bg-stone-100 text-stone-700', dot: 'bg-stone-400' },
  preview_ready: { chip: 'bg-amber-50 text-amber-800', dot: 'bg-amber-500' }, // waiting for the reviewer
  approved: { chip: 'bg-emerald-50 text-emerald-800', dot: 'bg-emerald-500' },
} as const
/** An archived project keeps its status (archiving is a flag); its badge says "archived" instead. */
export const ARCHIVED_STYLE = { chip: 'bg-stone-200 text-stone-700', dot: 'bg-stone-500' } as const
type ProjectStatus = keyof typeof STATUS_STYLE
export const STATUSES = Object.keys(STATUS_STYLE) as ProjectStatus[]
export const isStatus = (value: string): value is ProjectStatus => value in STATUS_STYLE
