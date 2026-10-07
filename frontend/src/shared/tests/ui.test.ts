import i18n from 'i18next'
import { describe, expect, it } from 'vitest'
import { btnClass, errMsg, fmtDate, optionsOf } from '../lib/ui'

describe('optionsOf', () => {
  it('turns values into [value, label] pairs using the label function', () => {
    expect(optionsOf(['de', 'en'], (l) => l.toUpperCase())).toEqual([
      ['de', 'DE'],
      ['en', 'EN'],
    ])
  })

  it('puts leading entries such as "all" first', () => {
    expect(optionsOf(['de'], (l) => l, ['', 'alle'])).toEqual([
      ['', 'alle'],
      ['de', 'de'],
    ])
  })
})

describe('btnClass', () => {
  it('uses the variant colours and appends extra classes', () => {
    expect(btnClass('primary', 'w-full')).toContain('bg-brand')
    expect(btnClass('primary', 'w-full')).toContain('w-full')
    expect(btnClass('danger')).toContain('text-red-700')
  })

  it('defaults to the secondary style', () => {
    expect(btnClass()).toBe(btnClass('secondary'))
  })
})

describe('errMsg', () => {
  it('uses the message of an Error and a translated fallback for anything else', () => {
    expect(errMsg(new Error('kaputt'))).toBe('kaputt')
    expect(errMsg('x')).toBe('Unbekannter Fehler')
  })
})

describe('fmtDate', () => {
  it('formats a UTC timestamp in the active interface language', async () => {
    expect(fmtDate('2026-10-03T14:05:00')).toMatch(/^03\.10\.26, \d\d:05$/)
    await i18n.changeLanguage('en')
    expect(fmtDate('2026-10-03T14:05:00')).toMatch(/^10\/3\/26, \d{1,2}:05\s?[AP]M$/)
    await i18n.changeLanguage('de')
  })
})
