import { useQuery } from '@tanstack/react-query'
import { get, type S } from '../api/client'

export const input =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 disabled:bg-slate-100'

export const errMsg = (e: unknown): string => (e instanceof Error ? e.message : 'Unbekannter Fehler')

export const fmtDate = (iso: string): string =>
  new Date(iso + 'Z').toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })

export function useSettings(): S['SettingsOut'] | undefined {
  return useQuery({ queryKey: ['settings'], queryFn: () => get<S['SettingsOut']>('/settings') }).data
}
