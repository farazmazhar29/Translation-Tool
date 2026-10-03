import { describe, expect, it } from 'vitest'
import type { S } from '../api/client'
import { EMPTY, toBody, toForm } from './entry'

describe('glossary form mapping', () => {
  it('trims terms, drops empty languages and splits synonyms', () => {
    const body = toBody(
      { ...EMPTY, de: ' Korpus ', en: 'carcass', synDe: 'Schrankkorpus; Kasten , ', synEn: '' },
      false,
    )
    expect(body.terms).toEqual({ de: 'Korpus', en: 'carcass' })
    expect(body.synonyms).toEqual({ de: ['Schrankkorpus', 'Kasten'], en: [] })
    expect(body.force).toBe(false)
  })

  it('omits a language that was left empty (do-not-translate entries)', () => {
    expect(toBody({ ...EMPTY, de: 'ProLine X', dnt: true }, false).terms).toEqual({ de: 'ProLine X' })
  })

  it('round-trips an entry through the form', () => {
    const entry: S['GlossaryOut'] = {
      id: 1,
      terms: { de: 'Korpus', en: 'carcass' },
      synonyms: { de: ['Kasten'], en: [] },
      description: 'Kasten',
      category: 'technical',
      do_not_translate: false,
      status: 'approved',
      version: 3,
      updated_by: 'x',
      updated_at: '2026-10-01T10:00:00',
    }
    const body = toBody(toForm(entry), true)
    expect(body.terms).toEqual(entry.terms)
    expect(body.synonyms['de']).toEqual(['Kasten'])
    expect(body.force).toBe(true)
  })
})
