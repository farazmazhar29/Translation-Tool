import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import i18n from 'i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { QualityWarning } from '@/shared/api/generated'
import { renderApp } from '@/testing/render'
import { server } from '@/testing/server'
import { QualityPanel } from '../components/QualityPanel'
import type { Run } from '../types'

afterEach(async () => {
  await i18n.changeLanguage('de')
})

const finding = (over: Partial<QualityWarning>): QualityWarning => ({
  segment_id: null,
  idx: -1,
  lang: 'en',
  type: 'term',
  code: null,
  params: {},
  severity: 'warning',
  message: '',
  key: `${String(over.code)}|${String(over.idx ?? -1)}`,
  accepted: false,
  ...over,
})

const missing = finding({
  type: 'missing_glossary',
  code: 'missing_glossary',
  params: { term: 'Korpus', count: '2', target: 'carcass' },
  severity: 'info',
  message: 'Fachbegriff „Korpus“ kommt 2× vor, fehlt aber im Glossar.',
})

const contradiction = finding({
  idx: 81,
  type: 'contradiction',
  code: 'contradiction',
  params: { term: 'Hängeschränke', variants: '„wall units“ / „wall cabinets“', options: 'wall units|wall cabinets' },
})

/** Serves the findings and records what the panel sends; `run` executes the action like the project page does. */
const setup = (warnings: QualityWarning[], over: { editable?: boolean; glossaryStatus?: number } = {}) => {
  const sent: { path: string; body: unknown }[] = []
  server.use(
    http.get('*/api/projects/1/quality', () =>
      HttpResponse.json({
        warnings,
        errors: warnings.filter((w) => w.severity === 'error').length,
        glossary_version: 4,
      }),
    ),
    http.post('*/api/projects/1/replace-term', async ({ request }) => {
      sent.push({ path: 'replace-term', body: await request.json() })
      return HttpResponse.json({ replaced_in_segments: 1 })
    }),
    http.put('*/api/projects/1/quality/accepted', async ({ request }) => {
      sent.push({ path: 'accepted', body: await request.json() })
      return HttpResponse.json([])
    }),
    http.post('*/api/glossary', async ({ request }) => {
      sent.push({ path: 'glossary', body: await request.json() })
      return over.glossaryStatus === 409
        ? HttpResponse.json({ detail: { message: 'Dublette' } }, { status: 409 })
        : HttpResponse.json({})
    }),
  )
  const done: Promise<unknown>[] = []
  const run: Run = (fn) => {
    done.push(fn())
  }
  const onSegment = vi.fn()
  renderApp(
    <QualityPanel
      projectId={1}
      lang="en"
      srcLang="de"
      editable={over.editable ?? true}
      run={run}
      onSegment={onSegment}
    />,
  )
  return { sent, done, onSegment }
}

describe('QualityPanel', () => {
  it('lists the findings of the quality check', async () => {
    setup([finding({ segment_id: 7, idx: 0, severity: 'error', message: 'Korpus fehlt' })])
    expect(await screen.findByText(/Korpus fehlt/)).toBeInTheDocument()
    expect(screen.getByText('1 Hinweis(e), 1 Fehler · Glossarversion 4')).toBeInTheDocument()
  })

  it('reports a clean result', async () => {
    setup([])
    expect(await screen.findByText('✔ Keine Probleme gefunden.')).toBeInTheDocument()
  })

  it('writes a finding in the language of the interface, from its code and values', async () => {
    await i18n.changeLanguage('en')
    setup([missing])
    expect(
      await screen.findByText('Technical term “Korpus” occurs 2× but is missing from the glossary.'),
    ).toBeInTheDocument()
  })

  it('shows the stored German message for a finding that has no code', async () => {
    await i18n.changeLanguage('en')
    setup([{ ...missing, code: null, params: {}, message: 'Alter Eintrag ohne Code' }])
    expect(await screen.findByText(/Alter Eintrag ohne Code/)).toBeInTheDocument()
  })

  it('opens the segment of a finding for editing', async () => {
    const { onSegment } = setup([finding({ segment_id: 7, idx: 4, message: 'Zahlen unterscheiden sich' })])
    await userEvent.click(await screen.findByRole('button', { name: 'Segment #5 bearbeiten' }))
    expect(onSegment).toHaveBeenCalledWith(4)
  })

  it('unifies a contradiction on the chosen translation, in every segment and in the glossary', async () => {
    const { sent, done } = setup([contradiction])
    await userEvent.click(await screen.findByRole('button', { name: '„wall cabinets“ überall verwenden' }))
    await Promise.all(done)
    expect(sent).toEqual([
      { path: 'replace-term', body: { lang: 'en', old: 'wall units', new: 'wall cabinets' } },
      { path: 'glossary', body: { terms: { de: 'Hängeschränke', en: 'wall cabinets' } } },
    ])
  })

  it('leaves the glossary alone when that is unticked', async () => {
    const { sent, done } = setup([contradiction])
    await userEvent.click(await screen.findByLabelText('Gewählte Übersetzung auch ins Glossar übernehmen'))
    await userEvent.click(screen.getByRole('button', { name: '„wall units“ überall verwenden' }))
    await Promise.all(done)
    expect(sent).toEqual([{ path: 'replace-term', body: { lang: 'en', old: 'wall cabinets', new: 'wall units' } }])
  })

  it('adds a frequent term to the glossary with the translation the text uses; an existing entry is fine', async () => {
    const { sent, done } = setup([missing], { glossaryStatus: 409 })
    await userEvent.click(await screen.findByRole('button', { name: 'Ins Glossar übernehmen: Korpus → carcass' }))
    await expect(Promise.all(done)).resolves.toBeDefined()
    expect(sent).toEqual([{ path: 'glossary', body: { terms: { de: 'Korpus', en: 'carcass' } } }])
  })

  it('confirms an ambiguous translation through the glossary', async () => {
    const ambiguous = finding({
      idx: 1,
      code: 'ambiguous_term',
      severity: 'info',
      params: { source: 'Stand', target: 'Status' },
    })
    const { sent, done } = setup([ambiguous])
    await userEvent.click(await screen.findByRole('button', { name: /^Übersetzung bestätigen/ }))
    await Promise.all(done)
    expect(sent).toEqual([{ path: 'glossary', body: { terms: { de: 'Stand', en: 'Status' } } }])
  })

  it('accepts a judgment call together with the ones accepted before; an error offers no "accept"', async () => {
    const before = finding({ idx: 2, code: 'too_long', severity: 'info', key: 'k-old', accepted: true })
    const hint = finding({ idx: 3, code: 'line_breaks_differ', severity: 'info', key: 'k-new' })
    const error = finding({ idx: 4, code: 'no_translation', severity: 'error', key: 'k-error' })
    const { sent, done } = setup([hint, error, before])
    expect(await screen.findByText('1 akzeptiert')).toBeInTheDocument() // accepted ones are counted, not listed
    expect(screen.getAllByRole('button', { name: 'Akzeptieren' })).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'Akzeptieren' }))
    await Promise.all(done)
    expect(sent).toEqual([{ path: 'accepted', body: { keys: ['k-old', 'k-new'] } }])
  })

  it('reopens all accepted findings', async () => {
    const { sent, done } = setup([finding({ idx: 2, code: 'too_long', severity: 'info', key: 'k', accepted: true })])
    expect(await screen.findByText('✔ Keine Probleme gefunden.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'wieder öffnen' }))
    await Promise.all(done)
    expect(sent).toEqual([{ path: 'accepted', body: { keys: [] } }])
  })

  it('offers no changes when the translation may not be edited, only a look at the segment', async () => {
    setup([contradiction, missing], { editable: false })
    expect(await screen.findByRole('button', { name: 'Segment #82 anzeigen' })).toBeInTheDocument()
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /überall verwenden|Ins Glossar|Akzeptieren/ }),
      ).not.toBeInTheDocument()
    })
  })
})
