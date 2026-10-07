import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Highlighted } from '@/features/glossary'
import { get, type S } from '@/shared/api/client'
import { Loading } from '@/shared/components/layout'
import { Card, ErrorText } from '@/shared/components/ui'
import type { Segment } from '../types'

type Cell = S['CellOut']
type Side = 'source' | 'target'

/** "B12" -> column 2, row 12. */
const position = (ref: string): { col: number; row: number } => {
  const [, letters = 'A', digits = '1'] = /^([A-Z]+)(\d+)$/.exec(ref) ?? []
  let col = 0
  for (let i = 0; i < letters.length; i++) col = col * 26 + letters.charCodeAt(i) - 64 // A=1 … Z=26, AA=27
  return { col, row: Number(digits) }
}

type Row =
  | { kind: 'empty'; row: number }
  | { kind: 'span'; row: number; cell: Cell; title: boolean } // a title or a group: one bold cell across the table
  | { kind: 'head' | 'body'; row: number; cells: (Cell | undefined)[] }

interface Grid {
  cols: number
  rows: Row[]
  numeric: Set<number> // columns holding numbers are right-aligned, their heads too
}

/** The cells of a sheet as rows and columns, each row classified; empty rows in between stay as spacing. */
const toGrid = (cells: readonly Cell[]): Grid => {
  const placed = cells.map((cell) => ({ cell, ...position(cell.ref) }))
  const cols = Math.max(1, ...placed.map((p) => p.col))
  const first = Math.min(...placed.map((p) => p.row))
  const last = Math.max(...placed.map((p) => p.row))
  const table = Array.from({ length: last - first + 1 }, () => Array<Cell | undefined>(cols).fill(undefined))
  for (const p of placed) {
    const line = table[p.row - first]
    if (line) line[p.col - 1] = p.cell
  }
  const rows = table.map((line, i): Row => {
    const row = first + i
    const filled = line.filter((c) => c !== undefined)
    const [only] = filled
    if (!only) return { kind: 'empty', row }
    if (filled.length === 1 && line[0] === only) return { kind: 'span', row, cell: only, title: i === 0 && only.bold }
    return { kind: filled.every((c) => c.bold) ? 'head' : 'body', row, cells: line }
  })
  const numeric = new Set(placed.filter((p) => typeof p.cell.value === 'number').map((p) => p.col - 1))
  return { cols, rows, numeric }
}

/** An article number ("FB-6001", "UK-4711/60") is not broken at its hyphen. */
const isWord = (cell: Cell | undefined): boolean =>
  typeof cell?.value === 'string' && !/\s/.test(cell.value) && /\d/.test(cell.value)

/** Long compounds ("Eckverbindungsbeschlag") are hyphenated in their language, and broken only as a last resort. */
const wrap = 'hyphens-auto [overflow-wrap:anywhere]'

interface Props {
  projectId: number
  segments: readonly Segment[]
  lang: string
  srcLang: string
  onTerm: (seg: Segment, term: S['Term']) => void
}

/**
 * An Excel file as the table it is, the original on the left and the translation on the right, row by row: the
 * rows and columns of the original sheet, numbers as they are. A row of bold cells is the column head; a row with a
 * single bold cell (a title or a group) spans its half. Where the screen is too narrow for both halves, each cell
 * shows the translation with the original below it.
 */
export const SheetView = ({ projectId, segments, lang, srcLang, onTerm }: Props) => {
  const { t, i18n } = useTranslation('projects')
  const { data: sheets, error } = useQuery({
    queryKey: ['project-cells', projectId],
    queryFn: () => get<S['SheetOut'][]>(`/projects/${projectId}/cells`),
    staleTime: Infinity, // the original file does not change
  })
  if (error) return <ErrorText error={error} />
  if (!sheets) return <Loading />

  const bySheetCell = new Map(
    segments.map((seg) => [`${String(seg.locator['sheet'])}!${String(seg.locator['cell'])}`, seg]),
  )
  const number = (cell: Cell): string =>
    new Intl.NumberFormat(i18n.language, cell.decimals ? { minimumFractionDigits: cell.decimals } : {}).format(
      Number(cell.value),
    )

  /** The cell on one side: the original text, its translation, or a number (the same on both sides). */
  const side = (sheet: string, cell: Cell, which: Side, extra = ''): ReactNode => {
    if (typeof cell.value === 'number') return number(cell)
    const seg = bySheetCell.get(`${sheet}!${cell.ref}`)
    if (!seg) return cell.value
    const tr = seg.translations[lang]
    if (which === 'target' && !tr)
      return <span className="text-xs italic text-stone-600">{t('row.notTranslated')}</span>
    return (
      <Highlighted
        text={which === 'source' ? seg.source_text : (tr?.text ?? '')}
        terms={tr?.terms ?? []}
        side={which}
        className={`leading-snug ${extra}`}
        onTerm={(term) => {
          onTerm(seg, term)
        }}
      />
    )
  }

  /** Narrow screens: the translation, and the original below it in small type. */
  const stacked = (sheet: string, cell: Cell, nowrap: boolean): ReactNode => {
    const seg = bySheetCell.get(`${sheet}!${cell.ref}`)
    const tr = seg?.translations[lang]
    const original = seg && tr && tr.text !== seg.source_text
    return (
      <>
        {side(sheet, cell, 'target', nowrap ? '!whitespace-nowrap' : '')}
        {original && (
          <span className="mt-0.5 block text-xs font-normal normal-case leading-snug tracking-normal text-stone-600">
            {seg.source_text}
          </span>
        )}
      </>
    )
  }

  const pad = 'px-2.5 py-2 align-top'
  const headText = 'text-xs font-bold uppercase tracking-wide text-stone-700'
  const divider = 'border-l-2 border-line' // between the original and the translation

  return (
    <div className="space-y-6">
      {sheets.map((sheet) => {
        if (!sheet.cells.length) return null
        const grid = toGrid(sheet.cells)
        const align = (col: number): string => (grid.numeric.has(col) ? 'text-right tabular-nums' : 'text-left')
        const half = (cells: (Cell | undefined)[], which: Side, head: boolean) =>
          cells.map((cell, col) => {
            const Tag = head ? 'th' : 'td'
            const edge = col === 0 ? (which === 'source' ? 'pl-4' : `pl-4 ${divider}`) : ''
            // numbers, their column heads and article numbers keep one line; text wraps
            const keep = grid.numeric.has(col) || isWord(cell)
            return (
              <Tag
                key={`${which}-${String(col)}`}
                scope={head ? 'col' : undefined}
                lang={which === 'source' ? srcLang || undefined : lang}
                className={`px-2 py-2 align-top ${edge} ${col === grid.cols - 1 ? 'pr-4' : ''} ${align(col)} ${keep ? 'whitespace-nowrap' : wrap} ${head ? headText : ''}`}
              >
                {cell ? side(sheet.name, cell, which, isWord(cell) ? '!whitespace-nowrap' : '') : null}
              </Tag>
            )
          })
        const spanned = (cell: Cell, title: boolean, which: Side, edge: string) => (
          <td
            colSpan={grid.cols}
            lang={which === 'source' ? srcLang || undefined : lang}
            className={`px-4 py-2 ${wrap} ${edge} ${title ? 'pt-5 text-lg font-bold' : cell.bold ? 'font-bold' : ''}`}
          >
            {side(sheet.name, cell, which)}
          </td>
        )
        const lines = (row: Row) =>
          row.kind === 'head' ? 'border-b-2 border-line' : row.kind === 'body' ? 'border-b border-line/70' : ''
        const shade = (row: Row) => (row.kind === 'span' && row.cell.bold && !row.title ? 'bg-stone-50' : '')

        return (
          <Card key={sheet.name} flush>
            {sheets.length > 1 && (
              <h2 className="border-b border-line px-5 py-3 text-sm font-bold">
                {t('sheet.name', { name: sheet.name })}
              </h2>
            )}
            {/* wide screens: original | translation, every row level with its translation */}
            <table className="hidden w-full border-collapse text-[13px] 2xl:table">
              <thead>
                <tr className="border-b border-line">
                  <th
                    colSpan={grid.cols}
                    scope="colgroup"
                    className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-stone-600"
                  >
                    {t('view.columnOriginal', { lang: srcLang.toUpperCase() || '?' })}
                  </th>
                  <th
                    colSpan={grid.cols}
                    scope="colgroup"
                    className={`px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-stone-600 ${divider}`}
                  >
                    {t('view.columnTranslation', { lang: lang.toUpperCase() })}
                  </th>
                </tr>
              </thead>
              <tbody>
                {grid.rows.map((row) => {
                  if (row.kind === 'empty')
                    return (
                      <tr key={row.row} aria-hidden="true" className="h-4">
                        <td colSpan={grid.cols} />
                        <td colSpan={grid.cols} className={divider} />
                      </tr>
                    )
                  if (row.kind === 'span')
                    return (
                      <tr key={row.row} className={shade(row)}>
                        {spanned(row.cell, row.title, 'source', '')}
                        {spanned(row.cell, row.title, 'target', divider)}
                      </tr>
                    )
                  return (
                    <tr key={row.row} className={lines(row)}>
                      {half(row.cells, 'source', row.kind === 'head')}
                      {half(row.cells, 'target', row.kind === 'head')}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {/* narrower screens: one table, the translation over the original */}
            <div className="overflow-x-auto 2xl:hidden">
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {grid.rows.map((row) => {
                    if (row.kind === 'empty') return <tr key={row.row} aria-hidden="true" className="h-4" />
                    if (row.kind === 'span')
                      return (
                        <tr key={row.row} className={shade(row)}>
                          <td
                            colSpan={grid.cols}
                            className={`px-4 py-2 ${row.title ? 'pt-5 text-lg font-bold' : row.cell.bold ? 'font-bold' : ''}`}
                          >
                            {stacked(sheet.name, row.cell, false)}
                          </td>
                        </tr>
                      )
                    const head = row.kind === 'head'
                    return (
                      <tr key={row.row} className={lines(row)}>
                        {row.cells.map((cell, col) => {
                          const Tag = head ? 'th' : 'td'
                          return (
                            <Tag
                              key={col}
                              scope={head ? 'col' : undefined}
                              className={`${pad} first:pl-4 last:pr-4 ${align(col)} ${isWord(cell) ? 'whitespace-nowrap' : ''} ${head ? headText : ''}`}
                            >
                              {cell ? stacked(sheet.name, cell, isWord(cell)) : null}
                            </Tag>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
