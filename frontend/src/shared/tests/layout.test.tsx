import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { BackLink, EmptyState, Form, Loading, PageHeader, Table } from '../components/layout'

describe('PageHeader', () => {
  it('shows the title as the page heading, with optional actions', () => {
    render(
      <PageHeader title="Projekte">
        <button type="button">Neu</button>
      </PageHeader>,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Projekte' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Neu' })).toBeInTheDocument()
  })

  it('works without actions', () => {
    render(<PageHeader title="Einstellungen" />)
    expect(screen.getByRole('heading', { name: 'Einstellungen' })).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('Loading and EmptyState', () => {
  it('render their text', () => {
    render(
      <>
        <Loading />
        <EmptyState>Noch nichts da.</EmptyState>
      </>,
    )
    expect(screen.getByText('Laden …')).toBeInTheDocument()
    expect(screen.getByText('Noch nichts da.')).toBeInTheDocument()
  })
})

describe('Table', () => {
  const rows = (
    <tr>
      <td>Zeile 1</td>
    </tr>
  )

  it('renders column headers and the given rows', () => {
    render(<Table headers={['Name', 'Status']}>{rows}</Table>)
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Name', 'Status'])
    expect(screen.getAllByRole('columnheader')[0]).toHaveAttribute('scope', 'col')
    expect(screen.getByText('Zeile 1')).toBeInTheDocument()
  })

  it('shows the empty message only when the list is known to be empty', () => {
    const { rerender } = render(
      <Table headers={['Name']} rowCount={0} emptyText="Keine Einträge.">
        {null}
      </Table>,
    )
    expect(screen.getByText('Keine Einträge.')).toBeInTheDocument()
    rerender(
      <Table headers={['Name']} rowCount={undefined} emptyText="Keine Einträge.">
        {null}
      </Table>,
    ) // still loading
    expect(screen.queryByText('Keine Einträge.')).not.toBeInTheDocument()
    rerender(
      <Table headers={['Name']} rowCount={1} emptyText="Keine Einträge.">
        {rows}
      </Table>,
    )
    expect(screen.queryByText('Keine Einträge.')).not.toBeInTheDocument()
  })

  it('lets the empty message span all columns', () => {
    render(
      <Table headers={['A', 'B', 'C']} rowCount={0} emptyText="Leer">
        {null}
      </Table>,
    )
    expect(screen.getByText('Leer')).toHaveAttribute('colspan', '3')
  })
})

describe('Form', () => {
  it('submits without reloading the page and shows the submit label', async () => {
    const onSubmit = vi.fn()
    render(
      <Form onSubmit={onSubmit} submitLabel="Speichern">
        <input aria-label="Feld" />
      </Form>,
    )
    await userEvent.type(screen.getByLabelText('Feld'), '{Enter}') // submitting with the keyboard works too
    expect(onSubmit).toHaveBeenCalledOnce()
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(onSubmit).toHaveBeenCalledTimes(2)
  })

  it('shows an error before the submit button and can disable it', () => {
    render(
      <Form onSubmit={vi.fn()} submitLabel="Los" disabled error={new Error('Das ging schief')}>
        <span>Inhalt</span>
      </Form>,
    )
    const form = within(screen.getByRole('button', { name: 'Los' }).closest('form') as HTMLElement)
    expect(form.getByText('Inhalt')).toBeInTheDocument()
    expect(form.getByText('Das ging schief')).toBeInTheDocument()
    expect(form.getByRole('button', { name: 'Los' })).toBeDisabled()
  })

  it('shows no error text without an error', () => {
    render(
      <Form onSubmit={vi.fn()} submitLabel="Los">
        <span>Inhalt</span>
      </Form>,
    )
    expect(screen.queryByText('Unbekannter Fehler')).not.toBeInTheDocument()
  })
})

describe('BackLink', () => {
  it('is a link to the list the page was opened from', () => {
    render(
      <MemoryRouter>
        <BackLink to="/projects">Zurück zu den Projekten</BackLink>
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Zurück zu den Projekten' })).toHaveAttribute('href', '/projects')
  })
})

describe('Form with a second button', () => {
  it('shows it next to the submit button without submitting the form', async () => {
    const onSubmit = vi.fn()
    render(
      <Form onSubmit={onSubmit} submitLabel="Anlegen" secondary={<button type="button">Abbrechen</button>}>
        <span>Inhalt</span>
      </Form>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Anlegen' })).toBeInTheDocument()
  })
})
