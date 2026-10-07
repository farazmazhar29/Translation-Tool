import { screen, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import type { S } from '@/shared/api/client'
import { segment, term } from '@/testing/fixtures'
import { renderApp } from '@/testing/render'
import { server } from '@/testing/server'
import { SheetView } from '../components/SheetView'

const cell = (ref: string, value: string | number, over: Partial<S['CellOut']> = {}): S['CellOut'] => ({
  ref,
  value,
  decimals: 0,
  bold: false,
  ...over,
})

const sheets: S['SheetOut'][] = [
  {
    name: 'Ersatzteile',
    cells: [
      cell('A1', 'Ersatzteilliste', { bold: true }),
      cell('A3', 'Art.-Nr.', { bold: true }),
      cell('B3', 'Bezeichnung', { bold: true }),
      cell('C3', 'Preis', { bold: true }),
      cell('A4', 'SC-110'),
      cell('B4', 'Scharnier mit Dämpfung'),
      cell('C4', 12.9, { decimals: 2 }),
    ],
  },
]

const translated = (id: number, ref: string, source: string, text: string) =>
  segment({
    id,
    source_text: source,
    locator: { type: 'xlsx', sheet: 'Ersatzteile', cell: ref },
    translations: {
      en: { text, original_text: text, terms: [term()], comment: '', edited: false, edited_by: '' },
    },
  })

const segments = [
  translated(1, 'A1', 'Ersatzteilliste', 'Spare parts list'),
  translated(2, 'A3', 'Art.-Nr.', 'Item no.'),
  translated(3, 'B3', 'Bezeichnung', 'Description'),
  translated(4, 'C3', 'Preis', 'Price'),
  translated(5, 'B4', 'Scharnier mit Dämpfung', 'Hinge with soft-close'),
]

/** Both layouts are rendered (CSS picks one by screen width): [original | translation] and the stacked one. */
const setup = async () => {
  server.use(http.get('*/api/projects/1/cells', () => HttpResponse.json(sheets)))
  renderApp(<SheetView projectId={1} segments={segments} lang="en" srcLang="de" onTerm={vi.fn()} />)
  const [sideBySide, stacked] = await screen.findAllByRole('table')
  if (!sideBySide || !stacked) throw new Error('expected both layouts')
  return { sideBySide, stacked }
}

const cellsOf = (row: HTMLElement | null | undefined): string[] =>
  row ? Array.from(row.querySelectorAll('td, th'), (c) => c.textContent) : []

describe('SheetView', () => {
  it('puts the original on the left and the translation on the right, row by row', async () => {
    const { sideBySide } = await setup()
    expect(cellsOf(within(sideBySide).getAllByRole('row')[0])).toEqual(['Original (DE)', 'Übersetzung (EN)'])
    const item = within(sideBySide).getByText('Hinge with soft-close').closest('tr')
    expect(cellsOf(item)).toEqual([
      'SC-110',
      'Scharnier mit Dämpfung',
      '12,90',
      'SC-110',
      'Hinge with soft-close',
      '12,90',
    ])
    const head = within(sideBySide).getByText('Item no.').closest('tr')
    expect(cellsOf(head)).toEqual(['Art.-Nr.', 'Bezeichnung', 'Preis', 'Item no.', 'Description', 'Price'])
  })

  it('lets a single bold cell span its half as the title', async () => {
    const { sideBySide } = await setup()
    expect(within(sideBySide).getByText('Ersatzteilliste').closest('td')).toHaveAttribute('colspan', '3')
    expect(within(sideBySide).getByText('Spare parts list').closest('td')).toHaveAttribute('colspan', '3')
  })

  it('on narrow screens shows the translation with the original below it', async () => {
    const { stacked } = await setup()
    const cell = within(stacked).getByText('Hinge with soft-close').closest('td')
    expect(cell).toHaveTextContent('Hinge with soft-closeScharnier mit Dämpfung')
  })

  it('keeps numbers with the decimals of their format, and cells without text as they are', async () => {
    const { stacked } = await setup()
    expect(within(stacked).getByText('12,90')).toBeInTheDocument() // German interface: decimal comma
    expect(within(stacked).getByText('SC-110')).toBeInTheDocument() // an article number has no translation
  })
})
