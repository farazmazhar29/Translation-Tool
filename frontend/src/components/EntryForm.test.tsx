import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import type { S } from '../api/client'
import { setToken } from '../api/client'
import { AuthProvider } from '../auth'
import { EMPTY } from '../lib/entry'
import { renderApp } from '../test/render'
import { server } from '../test/server'
import { EntryForm } from './EntryForm'

const duplicate: S['GlossaryOut'] = {
  id: 2,
  terms: { de: 'Korpus', en: 'carcass' },
  synonyms: {},
  description: '',
  category: 'technical',
  do_not_translate: false,
  status: 'approved',
  version: 1,
  updated_by: 'admin',
  updated_at: '2026-10-01T10:00:00',
}

function setup(role: 'translator' | 'reviewer' = 'translator') {
  setToken('t')
  server.use(
    http.get('*/api/auth/me', () => HttpResponse.json({ id: 1, username: 'u', full_name: '', role, active: true })),
  )
  const onDone = vi.fn()
  renderApp(
    <AuthProvider>
      <EntryForm initial={{ ...EMPTY, de: 'Wange', en: 'end panel' }} onDone={onDone} />
    </AuthProvider>,
  )
  return onDone
}

describe('EntryForm', () => {
  it('creates an entry and reports completion', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.post('*/api/glossary', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ ...duplicate, id: 3 })
      }),
    )
    const onDone = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    await waitFor(() => {
      expect(onDone).toHaveBeenCalled()
    })
    expect(body).toMatchObject({ terms: { de: 'Wange', en: 'end panel' }, force: false, category: 'technical' })
  })

  it('warns about duplicates and only saves anyway after confirmation', async () => {
    const bodies: Record<string, unknown>[] = []
    server.use(
      http.post('*/api/glossary', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        bodies.push(body)
        return body['force']
          ? HttpResponse.json({ ...duplicate, id: 3 })
          : HttpResponse.json({ detail: { message: 'Dublette gefunden', duplicates: [duplicate] } }, { status: 409 })
      }),
    )
    const onDone = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(await screen.findByText('Dublette gefunden:')).toBeInTheDocument()
    expect(screen.getByText('Korpus → carcass')).toBeInTheDocument()
    expect(onDone).not.toHaveBeenCalled()

    await userEvent.click(screen.getByLabelText('Trotzdem speichern'))
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    await waitFor(() => {
      expect(onDone).toHaveBeenCalled()
    })
    expect(bodies.map((b) => b['force'])).toEqual([false, true])
  })

  it('lets only reviewers choose the approval status', () => {
    setup('translator')
    expect(screen.queryByDisplayValue('Freigegeben')).not.toBeInTheDocument()
  })

  it('shows the status selector for reviewers', async () => {
    setup('reviewer')
    expect(await screen.findByDisplayValue('Freigegeben')).toBeInTheDocument()
  })

  it('disables the English field for "do not translate" entries', async () => {
    setup()
    await userEvent.click(screen.getByLabelText('Nicht übersetzen'))
    expect(screen.getByLabelText('Englisch')).toBeDisabled()
  })
})
