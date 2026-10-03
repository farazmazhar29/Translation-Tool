import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { project } from '@/testing/fixtures'
import { renderApp } from '@/testing/render'
import { server } from '@/testing/server'
import { ExportDialog } from '../components/ExportDialog'

const createObjectURL = vi.fn(() => 'blob:test')

beforeEach(() => {
  URL.createObjectURL = createObjectURL
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
  server.use(http.get('*/api/export-templates', () => HttpResponse.json([])))
})

describe('ExportDialog', () => {
  it('shows the Excel column settings only for Excel', async () => {
    renderApp(<ExportDialog project={project()} lang="en" onClose={vi.fn()} onDone={vi.fn()} />)
    expect(screen.queryByText(/Erweiterte Einstellungen/)).not.toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Format'), 'xlsx')
    expect(screen.getByText(/Erweiterte Einstellungen/)).toBeInTheDocument()
  })

  it('sends the freely chosen Excel columns and downloads the file', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.post('*/api/projects/1/export', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ id: 9, filename: 'out.xlsx' })
      }),
      http.get('*/api/exports/9/download', () => new HttpResponse('xlsx-bytes')),
    )
    const onDone = vi.fn()
    renderApp(<ExportDialog project={project()} lang="en" onClose={vi.fn()} onDone={onDone} />)
    await userEvent.selectOptions(screen.getByLabelText('Format'), 'xlsx')
    await userEvent.selectOptions(screen.getByLabelText('Inhalt'), 'both')
    const source = screen.getByLabelText('Spalte Ausgangssprache')
    await userEvent.clear(source)
    await userEvent.type(source, 'c')
    const target = screen.getByLabelText('Spalte Zielsprache')
    await userEvent.clear(target)
    await userEvent.type(target, 'f')
    await userEvent.click(screen.getByRole('button', { name: 'Exportieren & herunterladen' }))

    await waitFor(() => {
      expect(onDone).toHaveBeenCalled()
    })
    expect(body).toMatchObject({ lang: 'en', format: 'xlsx', mode: 'both', archive_after: true })
    expect(body['config']).toMatchObject({ source_col: 'C', target_col: 'F', start_row: 2 })
    expect(createObjectURL).toHaveBeenCalled()
  })

  it('does not send Excel settings for Word exports', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.post('*/api/projects/1/export', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ id: 9, filename: 'out.docx' })
      }),
      http.get('*/api/exports/9/download', () => new HttpResponse('docx-bytes')),
    )
    const onDone = vi.fn()
    renderApp(<ExportDialog project={project()} lang="en" onClose={vi.fn()} onDone={onDone} />)
    await userEvent.click(screen.getByRole('button', { name: 'Exportieren & herunterladen' }))
    await waitFor(() => {
      expect(onDone).toHaveBeenCalled()
    })
    expect(body).toMatchObject({ format: 'docx', config: null })
  })

  it('only accepts letters in column fields', async () => {
    renderApp(<ExportDialog project={project()} lang="en" onClose={vi.fn()} onDone={vi.fn()} />)
    await userEvent.selectOptions(screen.getByLabelText('Format'), 'xlsx')
    const col = screen.getByLabelText('Spalte Position')
    await userEvent.type(col, 'a1b')
    expect(col).toHaveValue('AB')
  })

  it('saves the current layout as a template', async () => {
    let saved: Record<string, unknown> = {}
    server.use(
      http.post('*/api/export-templates', async ({ request }) => {
        saved = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ id: 1, ...saved })
      }),
    )
    renderApp(<ExportDialog project={project()} lang="en" onClose={vi.fn()} onDone={vi.fn()} />)
    await userEvent.selectOptions(screen.getByLabelText('Format'), 'xlsx')
    await userEvent.type(screen.getByPlaceholderText('Name für neue Vorlage'), 'Standard')
    await userEvent.click(screen.getByRole('button', { name: 'Als Vorlage speichern' }))
    await waitFor(() => {
      expect(saved['name']).toBe('Standard')
    })
    expect(saved['format']).toBe('xlsx')
  })
})
