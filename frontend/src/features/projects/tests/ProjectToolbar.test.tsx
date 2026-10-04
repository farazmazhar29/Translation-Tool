import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/features/auth'
import { setToken, type S } from '@/shared/api/client'
import { projectDetail } from '@/testing/fixtures'
import { renderApp } from '@/testing/render'
import { server } from '@/testing/server'
import { ProjectToolbar } from '../components/ProjectToolbar'

const setup = async (
  role: 'translator' | 'reviewer',
  status: S['ProjectDetail']['status'],
  over: Partial<Parameters<typeof ProjectToolbar>[0]> = {},
) => {
  setToken('t')
  server.use(
    http.get('*/api/auth/me', () => HttpResponse.json({ id: 1, username: 'u', full_name: '', role, active: true })),
  )
  const props = { run: vi.fn(), onLang: vi.fn(), onPanel: vi.fn(), onExport: vi.fn() }
  renderApp(
    <AuthProvider>
      <ProjectToolbar
        project={projectDetail({ status })}
        lang="en"
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
  it('lets a translator submit a preview for review, but not approve it', async () => {
    const { run } = await setup('translator', 'preview_ready')
    await userEvent.click(await screen.findByRole('button', { name: 'Zur Prüfung senden' })) // roles load asynchronously
    expect(screen.queryByRole('button', { name: 'Übersetzung freigeben' })).not.toBeInTheDocument()
    expect(run).toHaveBeenCalledOnce()
  })

  it('lets a reviewer approve and reject a project that is in review', async () => {
    await setup('reviewer', 'in_review')
    expect(await screen.findByRole('button', { name: 'Übersetzung freigeben' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Zurückweisen' })).toBeInTheDocument()
  })

  it('offers export and reopening once the project is approved', async () => {
    const { onExport } = await setup('translator', 'approved')
    await userEvent.click(screen.getByRole('button', { name: 'Exportieren' }))
    expect(onExport).toHaveBeenCalledOnce()
    expect(await screen.findByRole('button', { name: 'Erneut öffnen' })).toBeInTheDocument()
  })

  it('toggles the panels', async () => {
    const { onPanel } = await setup('translator', 'in_review', { panel: 'quality' })
    await userEvent.click(screen.getByRole('button', { name: 'Qualitätsprüfung' }))
    expect(onPanel).toHaveBeenCalledWith(null) // the open panel closes
    await userEvent.click(screen.getByRole('button', { name: 'Verlauf' }))
    expect(onPanel).toHaveBeenCalledWith('history')
  })
})
