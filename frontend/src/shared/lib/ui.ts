import { useQuery } from '@tanstack/react-query'
import i18n from 'i18next'
import { get, type S } from '../api/client'

export const input =
  'w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-stone-400 focus:border-brand focus:ring-4 focus:ring-brand/15 disabled:bg-stone-100 disabled:text-stone-500'

export type Variant = 'primary' | 'secondary' | 'danger' | 'destructive' | 'ghost'
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-white shadow-sm hover:bg-brand-dark',
  secondary: 'border border-stone-300 bg-white text-ink hover:border-stone-400 hover:bg-stone-50',
  danger: 'border border-red-300 bg-white text-red-700 hover:bg-red-50',
  destructive: 'bg-red-700 text-white shadow-sm hover:bg-red-800',
  ghost: 'text-stone-600 hover:bg-stone-100 hover:text-ink',
}
/** Classes of a button; shared by real buttons and links that look like buttons. */
export const btnClass = (variant: Variant = 'secondary', extra = ''): string =>
  `inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${extra}`

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

/** A calendar day ("2026-09-23") without the year: "23.9." in German, "9/23" in English. */
export const fmtDay = (day: string): string =>
  new Date(`${day}T00:00:00`).toLocaleDateString(i18n.language, { day: 'numeric', month: 'numeric' })

export const useSettings = (): S['SettingsOut'] | undefined => {
  return useQuery({ queryKey: ['settings'], queryFn: () => get<S['SettingsOut']>('/settings') }).data
}
