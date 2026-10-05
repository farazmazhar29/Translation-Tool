import type { ReactNode } from 'react'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Btn, Card, ErrorText } from './ui'

/** "← Back to ..." above the title of a page that was opened from a list. */
export const BackLink = ({ to, children }: { to: string; children: ReactNode }) => (
  <Link
    to={to}
    className="mb-4 inline-flex items-center gap-1.5 rounded-full text-sm font-semibold text-stone-600 transition hover:text-brand"
  >
    <ArrowLeft className="size-4" aria-hidden="true" />
    {children}
  </Link>
)

/** Page title with an optional line of explanation and a row of actions on the right. */
export const PageHeader = ({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children?: ReactNode
}) => (
  <div className="flex flex-wrap items-end justify-between gap-4">
    <div>
      <h1 className="text-3xl font-bold">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-stone-600">{subtitle}</p>}
    </div>
    {children && <div className="flex flex-wrap gap-2">{children}</div>}
  </div>
)

export const Loading = () => {
  const { t } = useTranslation()
  return (
    <p className="flex items-center gap-2 text-stone-600" role="status">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      {t('loading')}
    </p>
  )
}

/** "Nothing here yet": an icon in a soft circle, the text and optionally the next step. */
export const EmptyState = ({
  children,
  icon,
  action,
}: {
  children: ReactNode
  icon?: ReactNode
  action?: ReactNode
}) => (
  <div className="flex flex-col items-center gap-3 py-8 text-center">
    {icon && (
      <span className="grid size-12 place-items-center rounded-full bg-brand-soft text-brand" aria-hidden="true">
        {icon}
      </span>
    )}
    <p className="max-w-sm text-sm text-stone-600">{children}</p>
    {action}
  </div>
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
      <thead className="border-b border-line bg-stone-50 text-[11px] uppercase tracking-wider text-stone-600">
        <tr>
          {headers.map((header) => (
            <th key={header} scope="col" className="px-4 py-3 font-semibold">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-line [&>tr:hover]:bg-stone-50/80">
        {children}
        {rowCount === 0 && emptyText && (
          <tr>
            <td colSpan={headers.length} className="px-4 py-12 text-center text-stone-600">
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
  secondary,
  children,
}: {
  onSubmit: () => void
  submitLabel: string
  disabled?: boolean
  error?: unknown
  className?: string
  submitClassName?: string
  secondary?: ReactNode // a second button next to the submit button, for example "Cancel"
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
    <div className="flex flex-wrap items-center gap-3">
      <Btn variant="primary" type="submit" className={submitClassName} disabled={disabled}>
        {submitLabel}
      </Btn>
      {secondary}
    </div>
  </form>
)
