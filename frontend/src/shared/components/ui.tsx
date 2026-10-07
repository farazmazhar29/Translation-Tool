import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, X, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { STATUS_STYLE, isStatus } from '../constants'
import { btnClass, errMsg, type Variant } from '../lib/ui'

export const Btn = ({
  variant = 'secondary',
  className = '',
  ...p
}: { variant?: Variant } & ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button type="button" {...p} className={btnClass(variant, className)} />
)

/** A round icon button for row actions; the label is its accessible name and its tooltip. */
export const IconAction = ({
  label,
  icon: Icon,
  destructive,
  onClick,
}: {
  label: string
  icon: LucideIcon
  destructive?: boolean
  onClick: () => void
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    className={`inline-grid size-9 place-items-center rounded-full text-stone-600 transition ${destructive ? 'hover:bg-red-50 hover:text-red-700' : 'hover:bg-stone-100 hover:text-ink'}`}
  >
    <Icon className="size-[18px]" aria-hidden="true" />
  </button>
)

/** A link that looks like a button. */
export const LinkBtn = ({
  to,
  variant = 'secondary',
  className = '',
  children,
}: {
  to: string
  variant?: Variant
  className?: string
  children: ReactNode
}) => (
  <Link to={to} className={btnClass(variant, className)}>
    {children}
  </Link>
)

export const StatusBadge = ({ status }: { status: string }) => {
  const { t } = useTranslation()
  const known = isStatus(status)
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${known ? STATUS_STYLE[status].chip : 'bg-stone-100 text-stone-700'}`}
    >
      <span
        className={`size-1.5 rounded-full ${known ? STATUS_STYLE[status].dot : 'bg-stone-400'}`}
        aria-hidden="true"
      />
      {known ? t(`status.${status}`) : status}
    </span>
  )
}

export const Card = ({
  title,
  children,
  className = '',
  flush,
}: {
  title?: string
  children: ReactNode
  className?: string
  flush?: boolean // no inner padding: for tables and lists that reach the edges
}) => {
  return (
    <section
      className={`min-w-0 rounded-2xl border border-line bg-white shadow-card ${flush ? '' : 'p-6'} ${className}`}
    >
      {title && <h2 className="mb-4 text-base font-bold">{title}</h2>}
      {children}
    </section>
  )
}

export const Modal = ({
  title,
  onClose,
  children,
  wide,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) => {
  const { t } = useTranslation()
  const titleId = useId()
  const dialog = useRef<HTMLDivElement>(null)
  useEffect(() => {
    dialog.current?.focus()
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])
  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/45 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose() // backdrop only
      }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`mt-12 w-full rounded-3xl bg-white p-7 shadow-pop outline-none ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h3 id={titleId} className="text-xl font-bold">
            {title}
          </h3>
          <button
            type="button"
            aria-label={t('close')}
            className="grid size-9 shrink-0 place-items-center rounded-full text-stone-600 transition hover:bg-stone-100 hover:text-ink"
            onClick={onClose}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export const Label = ({ text, children }: { text: string; children: ReactNode }) => (
  <label className="block text-sm">
    <span className="mb-1.5 block font-semibold text-stone-700">{text}</span>
    {children}
  </label>
)

export const ErrorText = ({ error }: { error: unknown }) =>
  error ? (
    <p className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {errMsg(error)}
    </p>
  ) : null
