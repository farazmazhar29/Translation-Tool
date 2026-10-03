import type { S } from '../api/client'

export const STATUS_LABEL: Record<string, string> = { approved: 'Freigegeben', draft: 'Entwurf', rejected: 'Abgelehnt' }
type Entry = S['GlossaryOut']
export interface Form {
  de: string
  en: string
  synDe: string
  synEn: string
  description: string
  category: 'technical' | 'product'
  dnt: boolean
  status: 'draft' | 'approved' | 'rejected'
}
export const EMPTY: Form = {
  de: '',
  en: '',
  synDe: '',
  synEn: '',
  description: '',
  category: 'technical',
  dnt: false,
  status: 'approved',
}
const list = (s: string): string[] =>
  s
    .split(/[;,]/)
    .map((x) => x.trim())
    .filter(Boolean)
export const toForm = (e: Entry): Form => ({
  de: e.terms['de'] ?? '',
  en: e.terms['en'] ?? '',
  synDe: (e.synonyms['de'] ?? []).join('; '),
  synEn: (e.synonyms['en'] ?? []).join('; '),
  description: e.description,
  category: e.category as Form['category'],
  dnt: e.do_not_translate,
  status: e.status as Form['status'],
})
export const toBody = (f: Form, force: boolean): S['GlossaryIn'] => ({
  terms: Object.fromEntries((['de', 'en'] as const).map((l) => [l, f[l].trim()] as const).filter(([, v]) => v)),
  synonyms: { de: list(f.synDe), en: list(f.synEn) },
  description: f.description,
  category: f.category,
  do_not_translate: f.dnt,
  status: f.status,
  force,
})
