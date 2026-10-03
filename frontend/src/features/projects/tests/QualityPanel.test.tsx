import { screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { renderApp } from '@/testing/render'
import { server } from '@/testing/server'
import { QualityPanel } from '../components/QualityPanel'

describe('QualityPanel', () => {
  it('lists the findings of the quality check', async () => {
    server.use(
      http.get('*/api/projects/1/quality', () =>
        HttpResponse.json({
          warnings: [{ segment_id: 7, idx: 0, lang: 'en', type: 'term', severity: 'error', message: 'Korpus fehlt' }],
          errors: 1,
          glossary_version: 4,
        }),
      ),
    )
    renderApp(<QualityPanel projectId={1} lang="en" />)
    expect(await screen.findByText(/Korpus fehlt/)).toBeInTheDocument()
    expect(screen.getByText('1 Hinweis(e), 1 Fehler · Glossarversion 4')).toBeInTheDocument()
  })

  it('reports a clean result', async () => {
    server.use(
      http.get('*/api/projects/1/quality', () => HttpResponse.json({ warnings: [], errors: 0, glossary_version: 1 })),
    )
    renderApp(<QualityPanel projectId={1} lang="en" />)
    expect(await screen.findByText('✔ Keine Probleme gefunden.')).toBeInTheDocument()
  })
})
