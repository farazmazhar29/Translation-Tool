import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { setToken } from '@/shared/api/client'
import { AuthProvider } from '@/features/auth'
import { project } from '@/testing/fixtures'
import { renderApp } from '@/testing/render'
import { server } from '@/testing/server'
import Projects from '../pages/Projects'

const setup = (role: 'translator' | 'admin' = 'translator') => {
  setToken('t')
  const urls: string[] = []
  server.use(
    http.get('*/api/users/current-user', () =>
      HttpResponse.json({ id: 1, username: 'u', full_name: '', role, active: true }),
    ),
    http.get('*/api/users/names', () => HttpResponse.json(['translator', 'reviewer'])),
    http.get('*/api/projects', ({ request }) => {
      urls.push(new URL(request.url).search)
      return HttpResponse.json([
        project({ name: 'Anleitung A', customer: 'ACME' }),
        project({ id: 2, name: 'Preisliste', status: 'preview_ready' }),
      ])
    }),
  )
  renderApp(
    <AuthProvider>
      <Projects />
    </AuthProvider>,
  )
  return urls
}

describe('Projects', () => {
  it('lists projects with a readable status', async () => {
    setup()
    expect(await screen.findByRole('link', { name: 'Anleitung A' })).toHaveAttribute('href', '/projects/1')
    const table = within(screen.getByRole('table'))
    expect(table.getByText('Freigegeben')).toBeInTheDocument()
    expect(table.getByText('In Prüfung')).toBeInTheDocument()
  })

  it('shows an archived project as archived, whatever its status', async () => {
    setup()
    server.use(http.get('*/api/projects', () => HttpResponse.json([project({ status: 'approved', archived: true })])))
    await userEvent.click(await screen.findByLabelText('Archivierte'))
    expect(await within(screen.getByRole('table')).findByText('Archiviert')).toBeInTheDocument()
    expect(within(screen.getByRole('table')).queryByText('Freigegeben')).not.toBeInTheDocument()
  })

  it('hides archived projects by default and re-queries when filters change', async () => {
    const urls = setup()
    await screen.findByText('Anleitung A')
    expect(urls[0]).toContain('archived=no')
    await userEvent.type(screen.getByPlaceholderText('Suche: Projekt, Datei, Kunde'), 'acme')
    await waitFor(() => {
      expect(urls.at(-1)).toContain('q=acme')
    })
    await userEvent.click(screen.getByLabelText('Archivierte'))
    await waitFor(() => {
      expect(urls.at(-1)).toContain('archived=only')
    })
  })

  it('archives a project through the API', async () => {
    let archived = false
    setup()
    server.use(
      http.post('*/api/projects/1/archive', () => {
        archived = true
        return HttpResponse.json(project({ archived: true }))
      }),
    )
    const row = (await screen.findByRole('link', { name: 'Anleitung A' })).closest('tr')
    expect(row).not.toBeNull()
    await userEvent.click(within(row as HTMLElement).getByRole('button', { name: 'Archivieren' }))
    await waitFor(() => {
      expect(archived).toBe(true)
    })
  })

  it('offers deletion to admins only', async () => {
    setup('translator')
    await screen.findByText('Anleitung A')
    expect(screen.queryByRole('button', { name: 'Löschen' })).not.toBeInTheDocument()
  })

  it('offers deletion to admins', async () => {
    setup('admin')
    expect(await screen.findAllByRole('button', { name: 'Löschen' })).toHaveLength(2)
  })
})
