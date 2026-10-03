import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import type { S } from '@/shared/api/client'
import { segment, term } from '@/testing/fixtures'
import { renderApp } from '@/testing/render'
import { server } from '@/testing/server'
import { TermDialog } from '../components/TermDialog'

const entry: S['GlossaryOut'] = {
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

const setup = (over: { term?: Partial<S['Term']>; editable?: boolean } = {}) => {
  const props = {
    term: term({ glossary_id: 5, description: 'Tragender Kasten', alternatives: ['cabinet body'], ...over.term }),
    seg: segment(),
    lang: 'en',
    src: 'de',
    projectId: 1,
    editable: over.editable ?? true,
    onClose: vi.fn(),
    onSegmentText: vi.fn(),
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
    expect(p.onSegmentText).toHaveBeenCalledWith('The cabinet body is white.')
    expect(p.onClose).toHaveBeenCalled()
  })

  it('replaces a term in the whole project through the API', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.post('*/api/projects/1/replace-term', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ replaced_in_segments: 3 })
      }),
    )
    const p = setup()
    const input = screen.getByLabelText('Neue Übersetzung')
    await userEvent.clear(input)
    await userEvent.type(input, 'body')
    await userEvent.click(screen.getByRole('button', { name: 'Im ganzen Projekt ersetzen' }))
    await waitFor(() => {
      expect(p.onChanged).toHaveBeenCalled()
    })
    expect(body).toEqual({ lang: 'en', old: 'carcass', new: 'body' })
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
