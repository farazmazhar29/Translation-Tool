import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { segment, term } from '@/testing/fixtures'
import { renderApp } from '@/testing/render'
import { PageView } from '../components/PageView'
import { ViewSwitch } from '../components/ViewSwitch'

const translation = (text: string) => ({
  text,
  original_text: text,
  terms: [term()],
  comment: '',
  edited: false,
  edited_by: '',
})

const document = [
  segment({
    id: 1,
    idx: 0,
    source_text: 'Montageanleitung Hängeschrank',
    translations: { en: translation('Assembly') },
  }),
  segment({ id: 2, idx: 1, source_text: 'Lieferumfang', translations: { en: translation('Scope of delivery') } }),
  segment({
    id: 3,
    idx: 2,
    source_text: 'Der Korpus ist weiß.',
    translations: { en: translation('The carcass is white.') },
  }),
  segment({ id: 4, idx: 3, source_text: 'Noch ein Absatz.', translations: {} }),
]

const setup = (onTerm = vi.fn()) => {
  renderApp(<PageView segments={document} lang="en" srcLang="de" onTerm={onTerm} />)
  return onTerm
}

describe('PageView', () => {
  it('shows original and translation as two columns with their captions', () => {
    setup()
    expect(screen.getByText('Original (DE)')).toBeInTheDocument()
    expect(screen.getByText('Übersetzung (EN)')).toBeInTheDocument()
    expect(screen.getByText('Scope of delivery')).toBeInTheDocument() // the translation, next to its original
  })

  it('sets the first line as the title and short lines without punctuation as headings', () => {
    setup()
    expect(screen.getByText('Montageanleitung Hängeschrank')).toHaveClass('text-2xl')
    expect(screen.getByText('Lieferumfang')).toHaveClass('text-lg')
    expect(screen.getByText('Der', { exact: false })).toHaveClass('leading-7') // running text
  })

  it('says so for a paragraph that has no translation yet', () => {
    setup()
    expect(screen.getByText('Noch nicht übersetzt')).toBeInTheDocument()
  })

  it('passes a clicked term on, from the original as well as from the translation', async () => {
    const onTerm = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Korpus' }))
    expect(onTerm).toHaveBeenCalledWith(
      expect.objectContaining({ id: 3 }),
      expect.objectContaining({ source: 'Korpus' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'carcass' }))
    expect(onTerm).toHaveBeenCalledTimes(2)
  })

  it('gives every paragraph the anchor that the quality check scrolls to', () => {
    setup()
    expect(document.length).toBe(4)
    expect(window.document.getElementById('seg-2')).not.toBeNull()
  })
})

describe('ViewSwitch', () => {
  it('marks the current view and reports a change', async () => {
    const onChange = vi.fn()
    renderApp(<ViewSwitch value="page" onChange={onChange} />)
    expect(screen.getByRole('button', { name: 'Seitenansicht' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Segmente bearbeiten' })).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(screen.getByRole('button', { name: 'Segmente bearbeiten' }))
    expect(onChange).toHaveBeenCalledWith('list')
  })
})
