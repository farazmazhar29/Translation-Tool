import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/features/auth'
import { setToken } from '@/shared/api/session'
import type { ProjectDetail } from '@/shared/api/generated'
import { projectDetail } from '@/testing/fixtures'
import { renderApp } from '@/testing/render'
import { server } from '@/testing/server'
import { ProjectToolbar } from '../components/ProjectToolbar'

const setup = async (
  role: 'translator' | 'reviewer',
  status: ProjectDetail['status'],
  over: Partial<Parameters<typeof ProjectToolbar>[0]> = {},
) => {
  setToken('t')
  server.use(
    http.get('*/api/users/current-user', () =>
      HttpResponse.json({ id: 1, username: 'u', full_name: '', role, active: true }),
    ),
  )
  const props = { run: vi.fn(), onPanel: vi.fn(), onExport: vi.fn() }
  renderApp(
    <AuthProvider>
      <ProjectToolbar
        project={projectDetail({ status })}
        panel={null}
        editable={status !== 'approved'}
        {...props}
        {...over}
      />
    </AuthProvider>,
  )
  await screen.findByRole('button', { name: 'Qualitätsprüfung' })
  return props
}

describe('ProjectToolbar', () => {
  it('lets a reviewer approve a finished preview, and offers no separate "send for review" step', async () => {
    await setup('reviewer', 'preview_ready')
    expect(await screen.findByRole('button', { name: 'Übersetzung freigeben' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Prüfung senden|Zurückweisen/ })).not.toBeInTheDocument()
  })

  it('does not let a translator approve', async () => {
    await setup('translator', 'preview_ready')
    await screen.findByRole('button', { name: 'Qualitätsprüfung' })
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Übersetzung freigeben' })).not.toBeInTheDocument()
    })
  })

  it('offers export and reopening once the project is approved', async () => {
    const { onExport } = await setup('translator', 'approved')
    await userEvent.click(screen.getByRole('button', { name: 'Exportieren' }))
    expect(onExport).toHaveBeenCalledOnce()
    expect(await screen.findByRole('button', { name: 'Erneut öffnen' })).toBeInTheDocument()
  })

  it('toggles the panels', async () => {
    const { onPanel } = await setup('translator', 'preview_ready', { panel: 'quality' })
    await userEvent.click(screen.getByRole('button', { name: 'Qualitätsprüfung' }))
    expect(onPanel).toHaveBeenCalledWith(null) // the open panel closes
    await userEvent.click(screen.getByRole('button', { name: 'Verlauf' }))
    expect(onPanel).toHaveBeenCalledWith('history')
  })
})

describe('ProjectToolbar approval dialog', () => {
  const finding = (message: string, severity: 'error' | 'warning' | 'info') => ({
    segment_id: null,
    idx: -1,
    lang: 'en',
    type: 'missing_glossary',
    severity,
    message,
  })
  const quality = (warnings: ReturnType<typeof finding>[], errors = 0) => {
    server.use(http.get('*/api/projects/1/quality', () => HttpResponse.json({ warnings, errors, glossary_version: 0 })))
  }

  it('leaves hints out of the question and approves after confirmation', async () => {
    quality([
      finding('Fachbegriff „korpus“ kommt 2× vor, fehlt aber im Glossar.', 'info'),
      finding('Zweiter Hinweis.', 'info'),
    ])
    const { run } = await setup('reviewer', 'preview_ready')
    await userEvent.click(await screen.findByRole('button', { name: 'Übersetzung freigeben' }))
    const dialog = await screen.findByRole('dialog', { name: 'Übersetzung freigeben?' })
    expect(dialog).toHaveTextContent('Übersetzung jetzt freigeben?')
    expect(dialog).not.toHaveTextContent('Fachbegriff')
    expect(within(dialog).queryByRole('list')).not.toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Übersetzung freigeben' }))
    expect(run).toHaveBeenCalledOnce()
  })

  it('warns about real problems with the number of errors and warnings', async () => {
    quality(
      [finding('Zahl fehlt.', 'warning'), finding('Begriff fehlt.', 'error'), finding('Nur ein Hinweis.', 'info')],
      1,
    )
    await setup('reviewer', 'preview_ready')
    await userEvent.click(await screen.findByRole('button', { name: 'Übersetzung freigeben' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('1 Fehler und 1 Warnung(en). Trotzdem freigeben?')
    expect(dialog).toHaveTextContent('Zahl fehlt.')
    expect(dialog).toHaveTextContent('Begriff fehlt.')
    expect(dialog).not.toHaveTextContent('Nur ein Hinweis.') // hints stay in the quality check
  })

  it('leads to the quality check without approving', async () => {
    quality([finding('Zahl fehlt.', 'warning')])
    const { run, onPanel } = await setup('reviewer', 'preview_ready')
    await userEvent.click(await screen.findByRole('button', { name: 'Übersetzung freigeben' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Alle in der Qualitätsprüfung ansehen' }))
    expect(onPanel).toHaveBeenCalledWith('quality')
    expect(run).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('asks a plain question when the quality check found nothing', async () => {
    quality([])
    await setup('reviewer', 'preview_ready')
    await userEvent.click(await screen.findByRole('button', { name: 'Übersetzung freigeben' }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('Übersetzung jetzt freigeben?')
  })
})
