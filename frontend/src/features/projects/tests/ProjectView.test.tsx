import { screen, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/features/auth'
import { setToken } from '@/shared/api/session'
import { projectDetail, segment } from '@/testing/fixtures'
import { renderApp } from '@/testing/render'
import { server } from '@/testing/server'
import ProjectView from '../pages/ProjectView'

vi.mock('../constants', async (original) => {
  const actual: Record<string, unknown> = await original()
  return { ...actual, POLL_MS: 20 } // poll fast in the test
})

const user = { id: 1, username: 'u', full_name: '', role: 'translator', active: true }

const setup = () => {
  setToken('t')
  renderApp(
    <AuthProvider>
      <Routes>
        <Route path="projects/:id" element={<ProjectView />} />
      </Routes>
    </AuthProvider>,
    '/projects/1',
  )
}

describe('ProjectView while a translation runs', () => {
  it('asks the small status endpoint for the progress and loads the project again only when the job is over', async () => {
    let projectRequests = 0
    let statusRequests = 0
    server.use(
      http.get('*/api/users/current-user', () => HttpResponse.json(user)),
      http.get('*/api/projects/1', () => {
        projectRequests += 1
        const finished = projectRequests > 1
        return HttpResponse.json(
          finished
            ? projectDetail({ job_state: 'done', job_progress: 100, status: 'preview_ready' })
            : projectDetail({ job_state: 'running', job_progress: 0, segments: [] }),
        )
      }),
      http.get('*/api/projects/1/status', () => {
        statusRequests += 1
        const progress = statusRequests * 30
        return HttpResponse.json({
          job_state: progress < 90 ? 'running' : 'done',
          job_progress: Math.min(progress, 100),
          job_error: '',
          status: 'new',
        })
      }),
    )
    setup()
    expect(await screen.findByText(/Übersetzung läuft/)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText(/Übersetzung läuft/)).not.toBeInTheDocument() // the job is over
    })
    expect(projectRequests).toBe(2) // once at the start, once at the end: not once per poll
    expect(statusRequests).toBe(3) // 30 %, 60 %, finished
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(statusRequests).toBe(3) // and no more polling afterwards
  })

  it('does not poll at all when no translation is running', async () => {
    let statusRequests = 0
    server.use(
      http.get('*/api/users/current-user', () => HttpResponse.json(user)),
      http.get('*/api/projects/1', () => HttpResponse.json(projectDetail({ segments: [segment()] }))),
      http.get('*/api/projects/1/status', () => {
        statusRequests += 1
        return HttpResponse.json({ job_state: 'idle', job_progress: 0, job_error: '', status: 'new' })
      }),
    )
    setup()
    await screen.findByText('Testprojekt')
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(statusRequests).toBe(0)
  })
})
