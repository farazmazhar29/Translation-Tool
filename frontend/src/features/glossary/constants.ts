/** Values the API uses for glossary entries. Their labels are translations (`category.*`, `status.*`). */
export const ENTRY_CATEGORIES = ['technical', 'product'] as const
export const ENTRY_STATUSES = ['approved', 'draft', 'rejected'] as const
type EntryStatus = (typeof ENTRY_STATUSES)[number]
export const isEntryStatus = (value: string): value is EntryStatus =>
  (ENTRY_STATUSES as readonly string[]).includes(value)

export const STATUS_CLS: Record<EntryStatus, string> = {
  approved: 'text-green-700',
  draft: 'text-amber-700',
  rejected: 'text-red-700',
}

/** Highlight colour per term category when the user has not configured one. */
export const FALLBACK: Record<string, string> = {
  technical: '#3b82f6',
  glossary: '#22c55e',
  ambiguous: '#f59e0b',
  unknown: '#ef4444',
  protected: '#a855f7',
}
