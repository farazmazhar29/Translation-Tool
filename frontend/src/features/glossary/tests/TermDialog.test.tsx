import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import type { GlossaryOut, Term } from '@/shared/api/generated'
import { segment, term } from '@/testing/fixtures'
import { renderApp } from '@/testing/render'
import { server } from '@/testing/server'
import { TermDialog } from '../components/TermDialog'

const entry: GlossaryOut = {
  id: 5,
  terms: { de: 'Korpus', en: 'carcass' },
  synonyms: {},
  description: 'Kasten',
  category: 'technical',
  do_not_translate: false,
  status: 'approved',
  version: 2,
  updated_by: 'admin',
  updated_at: '2026-10-01T10:00:00',
}

const setup = (over: { term?: Partial<Term>; editable?: boolean; text?: string; replaced?: number } = {}) => {
  const text = over.text ?? 'The carcass is white.'
  const translation = { text, original_text: text, terms: [term()], comment: '', edited: false, edited_by: '' }
  const props = {
    term: term({ glossary_id: 5, description: 'Tragender Kasten', alternatives: ['cabinet body'], ...over.term }),
    seg: segment({ translations: { en: translation } }),
    lang: 'en',
    src: 'de',
    editable: over.editable ?? true,
    onClose: vi.fn(),
    onReplace: vi.fn(() => Promise.resolve(over.replaced ?? 1)),
    onChanged: vi.fn(),
  }
  server.use(http.get('*/api/glossary', () => HttpResponse.json([entry])))
  renderApp(<TermDialog {...props} />)
  return props
}

describe('TermDialog', () => {
  it('shows category, used translation, description, alternatives and the glossary entry', async () => {
    setup()
    expect(screen.getByText('Glossarbegriff')).toBeInTheDocument()
    expect(screen.getByText('carcass')).toBeInTheDocument()
    expect(screen.getByText('Tragender Kasten')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'cabinet body' })).toBeInTheDocument()
    expect(await screen.findByText(/Korpus → carcass · v2/)).toBeInTheDocument()
  })

  it('uses an alternative translation in the current segment only', async () => {
    const p = setup()
    await userEvent.click(screen.getByRole('button', { name: 'cabinet body' }))
    expect(p.onReplace).toHaveBeenCalledWith('carcass', 'cabinet body', true)
    await waitFor(() => {
      expect(p.onClose).toHaveBeenCalled()
    })
  })

  it('replaces a term in the segment or the whole project through the function the project page passes', async () => {
    const p = setup()
    const input = screen.getByLabelText('Neue Übersetzung')
    await userEvent.clear(input)
    await userEvent.type(input, 'body')
    await userEvent.click(screen.getByRole('button', { name: 'Nur in diesem Segment ersetzen' }))
    expect(p.onReplace).toHaveBeenLastCalledWith('carcass', 'body', true)
    await userEvent.click(screen.getByRole('button', { name: 'Im ganzen Projekt ersetzen' }))
    expect(p.onReplace).toHaveBeenLastCalledWith('carcass', 'body', false)
    await waitFor(() => {
      expect(p.onChanged).toHaveBeenCalled()
    })
  })

  it('starts from the text as it stands, so an earlier typo can be undone', async () => {
    const p = setup({ text: 'The carcassll is white.' })
    expect(screen.getByText('carcassll')).toBeInTheDocument() // used translation
    const input = screen.getByLabelText('Neue Übersetzung')
    expect(input).toHaveValue('carcassll')
    await userEvent.clear(input)
    await userEvent.type(input, 'carcass')
    await userEvent.click(screen.getByRole('button', { name: 'Nur in diesem Segment ersetzen' }))
    expect(p.onReplace).toHaveBeenCalledWith('carcassll', 'carcass', true)
  })

  it('says so when the text was not found, instead of closing', async () => {
    const p = setup({ replaced: 0 })
    await userEvent.type(screen.getByLabelText('Neue Übersetzung'), 's')
    await userEvent.click(screen.getByRole('button', { name: 'Nur in diesem Segment ersetzen' }))
    expect(await screen.findByText(/steht nicht als ganzes Wort/)).toBeInTheDocument()
    expect(p.onClose).not.toHaveBeenCalled()
  })

  it('disables replacing until the text actually changed', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Im ganzen Projekt ersetzen' })).toBeDisabled()
  })

  it('is read-only when the project is no longer editable', () => {
    setup({ editable: false })
    expect(screen.queryByText('Direkt bearbeiten')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'cabinet body' })).toBeDisabled()
  })

  it('offers "add to glossary" only for terms that are not in the glossary yet', () => {
    setup({ term: { category: 'technical', glossary_id: null } })
    expect(screen.getByRole('button', { name: 'Ins Glossar übernehmen' })).toBeInTheDocument()
  })

  it('does not offer "add to glossary" for glossary terms', () => {
    setup()
    expect(screen.queryByRole('button', { name: 'Ins Glossar übernehmen' })).not.toBeInTheDocument()
  })
})
