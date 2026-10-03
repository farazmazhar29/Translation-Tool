import i18n from 'i18next'
import { afterEach, describe, expect, it } from 'vitest'

afterEach(async () => {
  await i18n.changeLanguage('de')
})

describe('i18n', () => {
  it('speaks German and English', async () => {
    expect(i18n.t('common:save')).toBe('Speichern')
    await i18n.changeLanguage('en')
    expect(i18n.t('common:save')).toBe('Save')
  })

  it('falls back to English for a language the app does not have', async () => {
    await i18n.changeLanguage('fr')
    expect(i18n.t('common:save')).toBe('Save')
  })

  it('maps regional variants to the base language', async () => {
    await i18n.changeLanguage('de-DE')
    expect(i18n.t('common:save')).toBe('Speichern')
  })

  it('interpolates values and pluralises', async () => {
    await i18n.changeLanguage('en')
    expect(i18n.t('projects:view.segments', { count: 1 })).toMatch(/1 segment\b/i)
    expect(i18n.t('projects:view.segments', { count: 3 })).toMatch(/3 segments/i)
  })
})
