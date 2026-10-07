import { describe, expect, it } from 'vitest'
import { term } from '@/testing/fixtures'
import { chunkify, shownTarget } from '../lib/chunkify'

describe('chunkify', () => {
  it('returns one plain chunk when there are no terms', () => {
    expect(chunkify('Hallo Welt', [], 'source')).toEqual([{ text: 'Hallo Welt' }])
  })

  it('splits text around a term and keeps the original casing', () => {
    const t = term({ source: 'korpus' })
    const chunks = chunkify('Der Korpus ist weiß', [t], 'source')
    expect(chunks.map((c) => c.text)).toEqual(['Der ', 'Korpus', ' ist weiß'])
    expect(chunks[1]?.term).toBe(t)
  })

  it('uses the target side for the translation column', () => {
    const chunks = chunkify('The carcass is white', [term()], 'target')
    expect(chunks.find((c) => c.term)?.text).toBe('carcass')
  })

  it('prefers the longest term and never overlaps', () => {
    const long = term({ source: 'Rotpunkt Kitchen Line' })
    const short = term({ source: 'Rotpunkt' })
    const chunks = chunkify('Die Rotpunkt Kitchen Line', [short, long], 'source')
    expect(chunks.filter((c) => c.term).map((c) => c.text)).toEqual(['Rotpunkt Kitchen Line'])
  })

  it('marks every occurrence', () => {
    const chunks = chunkify('Korpus und Korpus', [term()], 'source')
    expect(chunks.filter((c) => c.term)).toHaveLength(2)
  })

  it('ignores terms with an empty side', () => {
    expect(chunkify('abc', [term({ target: '' })], 'target')).toEqual([{ text: 'abc' }])
  })

  it('marks whole words in the translation, so a plural or a typo after the term is part of it', () => {
    const marked = (text: string) =>
      chunkify(text, [term()], 'target')
        .filter((c) => c.term)
        .map((c) => c.text)
    expect(marked('Two carcasses, one carcassll.')).toEqual(['carcasses', 'carcassll'])
  })

  it('keeps exact matches in the source, where a compound is not its part', () => {
    const chunks = chunkify('Die Korpusbreite', [term()], 'source')
    expect(chunks.find((c) => c.term)?.text).toBe('Korpus')
  })
})

describe('shownTarget', () => {
  it('is the translation as it stands in the text, or the stored one when it is not there', () => {
    expect(shownTarget('The Carcassll is white.', 'carcass')).toBe('Carcassll')
    expect(shownTarget('Nothing here.', 'carcass')).toBe('carcass')
  })
})
