import type { Lang, Role, S } from './api/client'

/** Values the API uses. Their labels are translated: see `shared/i18n` (`lang.*`, `status.*`, ...). */
export const LANGS: readonly Lang[] = ['de', 'en']
export const ROLES: readonly Role[] = ['translator', 'reviewer', 'admin']
export const TERM_CATEGORIES: readonly S['Term']['category'][] = [
  'technical',
  'glossary',
  'ambiguous',
  'unknown',
  'protected',
]
export const EXPORT_FORMATS = ['docx', 'xlsx', 'pdf'] as const
export const EXPORT_MODES = ['translation', 'both'] as const

/** Badge colours per project status. */
export const STATUS_STYLE = {
  new: 'bg-slate-100 text-slate-700',
  preview_ready: 'bg-blue-100 text-blue-700',
  in_review: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-700',
  archived: 'bg-zinc-200 text-zinc-600',
} as const
type ProjectStatus = keyof typeof STATUS_STYLE
export const STATUSES = Object.keys(STATUS_STYLE) as ProjectStatus[]
export const isStatus = (value: string): value is ProjectStatus => value in STATUS_STYLE
