import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Btn, Card, ErrorText } from './ui'

/** Page title with an optional row of actions on the right. */
export const PageHeader = ({ title, children }: { title: string; children?: ReactNode }) => (
  <div className="flex flex-wrap items-center justify-between gap-2">
    <h1 className="text-xl font-semibold">{title}</h1>
    {children && <div className="flex flex-wrap gap-2">{children}</div>}
  </div>
)

export const Loading = () => {
  const { t } = useTranslation()
  return <p className="text-slate-600">{t('loading')}</p>
}

export const EmptyState = ({ children }: { children: ReactNode }) => (
  <p className="text-sm text-slate-600">{children}</p>
)

/**
 * Card with a table: the shell of every list screen. Pass the `<tr>` rows as children. With `rowCount` (the number
 * of rows, `undefined` while loading) and `emptyText` an empty list shows a message instead of a blank table.
 */
export const Table = ({
  headers,
  rowCount,
  emptyText,
  children,
}: {
  headers: readonly string[]
  rowCount?: number
  emptyText?: string
  children: ReactNode
}) => (
  <Card className="overflow-x-auto p-0">
    <table className="w-full text-left text-sm">
      <thead className="border-b bg-slate-50 text-xs uppercase text-slate-600">
        <tr>
          {headers.map((header) => (
            <th key={header} scope="col" className="px-3 py-2">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y">
        {children}
        {rowCount === 0 && emptyText && (
          <tr>
            <td colSpan={headers.length} className="px-3 py-8 text-center text-slate-600">
              {emptyText}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </Card>
)

/** A form that does not reload the page and ends with the error message and the submit button. */
export const Form = ({
  onSubmit,
  submitLabel,
  disabled,
  error,
  className = 'space-y-3',
  submitClassName = '',
  children,
}: {
  onSubmit: () => void
  submitLabel: string
  disabled?: boolean
  error?: unknown
  className?: string
  submitClassName?: string
  children: ReactNode
}) => (
  <form
    className={className}
    onSubmit={(e) => {
      e.preventDefault()
      onSubmit()
    }}
  >
    {children}
    <ErrorText error={error} />
    <Btn variant="primary" type="submit" className={submitClassName} disabled={disabled}>
      {submitLabel}
    </Btn>
  </form>
)
