import { screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import i18n from 'i18next'
import { afterEach, describe, expect, it } from 'vitest'
import { renderApp } from '@/testing/render'
import { server } from '@/testing/server'
import { QualityPanel } from '../components/QualityPanel'

afterEach(async () => {
  await i18n.changeLanguage('de')
})

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

  const withCode = {
    segment_id: null,
    idx: -1,
    lang: 'en',
    type: 'missing_glossary',
    code: 'missing_glossary',
    params: { term: 'korpus', count: '2' },
    severity: 'info',
    message: 'Fachbegriff „korpus“ kommt 2× vor, fehlt aber im Glossar.',
  }

  it('writes a finding in the language of the interface, from its code and values', async () => {
    server.use(
      http.get('*/api/projects/1/quality', () =>
        HttpResponse.json({ warnings: [withCode], errors: 0, glossary_version: 0 }),
      ),
    )
    await i18n.changeLanguage('en')
    renderApp(<QualityPanel projectId={1} lang="en" />)
    expect(
      await screen.findByText('Technical term “korpus” occurs 2× but is missing from the glossary.'),
    ).toBeInTheDocument()
  })

  it('shows the stored German message for a finding that has no code', async () => {
    server.use(
      http.get('*/api/projects/1/quality', () =>
        HttpResponse.json({
          warnings: [{ ...withCode, code: null, params: {}, message: 'Alter Eintrag ohne Code' }],
          errors: 0,
          glossary_version: 0,
        }),
      ),
    )
    await i18n.changeLanguage('en')
    renderApp(<QualityPanel projectId={1} lang="en" />)
    expect(await screen.findByText(/Alter Eintrag ohne Code/)).toBeInTheDocument()
  })
})
