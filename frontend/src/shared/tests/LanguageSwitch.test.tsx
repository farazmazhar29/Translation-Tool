import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from 'i18next'
import { afterEach, describe, expect, it } from 'vitest'
import { LanguageSwitch } from '../components/LanguageSwitch'

afterEach(async () => {
  await i18n.changeLanguage('de')
})

describe('LanguageSwitch', () => {
  it('marks the active language and switches the interface and the html lang attribute', async () => {
    render(<LanguageSwitch />)
    expect(screen.getByRole('group', { name: 'Sprache der Oberfläche' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'DE' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'EN' }))
    expect(screen.getByRole('group', { name: 'Interface language' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true')
    expect(document.documentElement.lang).toBe('en')
  })
})
