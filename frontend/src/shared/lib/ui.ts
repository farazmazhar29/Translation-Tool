import { useQuery } from '@tanstack/react-query'
import i18n from 'i18next'
import { get, type S } from '../api/client'

export const input =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 disabled:bg-slate-100'

export type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-red-700 text-white hover:bg-red-800',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
  danger: 'bg-white border border-red-300 text-red-700 hover:bg-red-50',
  ghost: 'text-slate-600 hover:bg-slate-100',
}
/** Classes of a button; shared by real buttons and links that look like buttons. */
export const btnClass = (variant: Variant = 'secondary', extra = ''): string =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${extra}`

/** [value, label] pair of a <select>. */
export type Option = readonly [value: string, label: string]

/** Options for a list of values: `label(value)` is the (translated) text, `leading` entries such as "all" come first. */
export const optionsOf = <T extends string>(
  values: readonly T[],
  label: (value: T) => string,
  ...leading: Option[]
): Option[] => [...leading, ...values.map((value): Option => [value, label(value)])]

/** Adds the item to the list, or removes it when it is already in. */
export const toggle = <T>(list: readonly T[], item: T): T[] =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item]

export const errMsg = (e: unknown): string => (e instanceof Error ? e.message : i18n.t('common:unknownError'))

export const fmtDate = (iso: string): string =>
  new Date(iso + 'Z').toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' })

export const useSettings = (): S['SettingsOut'] | undefined => {
  return useQuery({ queryKey: ['settings'], queryFn: () => get<S['SettingsOut']>('/settings') }).data
}
