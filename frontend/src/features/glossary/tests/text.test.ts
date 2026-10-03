import { describe, expect, it } from 'vitest'
import { escapeRe, replaceFirst } from '../lib/text'

describe('text helpers', () => {
  it('escapes regex metacharacters', () => {
    expect(new RegExp(escapeRe('a.b*c(d)')).test('a.b*c(d)')).toBe(true)
    expect(new RegExp(escapeRe('a.b')).test('axb')).toBe(false)
  })

  it('replaces only the first match, case-insensitively', () => {
    expect(replaceFirst('Carcass and carcass', 'carcass', 'body')).toBe('body and carcass')
  })

  it('treats "$" in the replacement literally', () => {
    expect(replaceFirst('price', 'price', '$& 5')).toBe('$& 5')
  })

  it('returns the text unchanged when nothing matches', () => {
    expect(replaceFirst('abc', 'x', 'y')).toBe('abc')
  })
})
